import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { isSystemPaused } from "@/lib/systemStatus";
import { PrivateKey, PublicKey, Transaction, Utils } from "@bsv/sdk";
import { getBurnWif, MNEE_API } from "@/env";
import { fetchConfig, fetchTransaction, fetchTxo } from "@/utils/api";
import CosignTemplate from "@/templates/cosign";
import { applyInscription, type Inscription } from "js-1sat-ord";
import type { IndexContext } from "@/types/indexContext";
import type { RefundRequest } from "@/types/refund";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitrefundUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { recordTransaction, TransactionType } from "@/lib/recordTransactions";
const { toBase64 } = Utils;

async function broadcastRefundTransaction(
  refundRequest: RefundRequest
): Promise<{ success: boolean; txid?: string; error?: string }> {
  console.log("Starting broadcastRefundTransaction:", { refundRequestId: refundRequest.id, outpoint: refundRequest.outpoint });

  try {
    const config = await fetchConfig();
    if (!config) {
      console.error("Config not found in database");
      return {
        success: false,
        error: "System configuration not found"
      };
    }

    const [sourceTXID, voutStr] = refundRequest.outpoint.split("_");
    const vout = Number.parseInt(voutStr, 10);

    if (!sourceTXID || Number.isNaN(vout)) {
      console.error("Invalid outpoint format:", refundRequest.outpoint);
      return {
        success: false,
        error: "Invalid outpoint format"
      };
    }

    console.log("Creating refund transaction");
    // Create refund transaction
    const burnPk = PrivateKey.fromWif(await getBurnWif());
    const tx = new Transaction();

    // Add input from burn address
    const sourceTransaction = await fetchTransaction(sourceTXID);
    tx.addInput({
      sourceTXID,
      sourceOutputIndex: vout,
      sourceTransaction,
      unlockingScriptTemplate: new CosignTemplate().userUnlock(
        burnPk,
        "all",
        true
      ),
    });

    // get the parsed MNEEUtxo for the amount
    const txo = await fetchTxo(refundRequest.outpoint);
    const amount = txo.data.bsv21.amt;
    const cosignScript = new CosignTemplate().lock(
      refundRequest.refundAddress,
      PublicKey.fromString(config.approver)
    );
    const inscriptionData = {
      p: "bsv-20",
      op: "transfer",
      id: config.tokenId,
      amt: amount.toString(),
    };
    const dataB64 = Buffer.from(JSON.stringify(inscriptionData)).toString(
      "base64"
    );
    const inscription = {
      dataB64,
      contentType: "application/bsv-20",
    } as Inscription;
    const lockingScript = applyInscription(cosignScript, inscription);

    // Add output to the refund address
    tx.addOutput({
      lockingScript,
      satoshis: 1,
    });

    await tx.fee();
    await tx.sign();

    console.log("Broadcasting refund transaction to MNEE API");
    // Broadcast transaction
    const broadcastResponse = await fetch(`${MNEE_API}/v1/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawtx: toBase64(tx.toBinary()),
      }),
    });

    console.log("MNEE API Response status:", broadcastResponse.status, broadcastResponse.statusText);

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      console.error("MNEE API returned error status:", {
        status: broadcastResponse.status,
        statusText: broadcastResponse.statusText,
        errorText
      });
      return {
        success: false,
        error: `MNEE API error (${broadcastResponse.status}): ${errorText || broadcastResponse.statusText}`
      };
    }

    const responseData = await broadcastResponse.json() as any;
    console.log("Refund broadcast response:", responseData);

    if (!responseData.rawtx) {
      console.error("No transaction ID returned from MNEE API");
      return {
        success: false,
        error: "No transaction ID returned from broadcast"
      };
    }

    console.log("Refund transaction broadcast successful, rawtx:", responseData.rawtx);

    return {
      success: true,
      txid: Transaction.fromHex(Buffer.from(responseData.rawtx, 'base64').toString('hex')).hash('hex') as string
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown broadcast error');
    console.error("Error during refund transaction broadcast:", {
      error: errorMessage,
      errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'Unknown'
    });
    return {
      success: false,
      error: `Broadcast failed: ${errorMessage}`
    };
  }
}

export const POST = withCSRF(async function (request: Request) {
  console.log("Starting approveRefund request");
  const session = await getServerSession(authOptions);
  console.log("Session:", { userId: session?.user?.id });
  if (!session?.user?.id) {
    console.log("Unauthorized: No session or user ID");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let refundRequestId: string = "";
  try {
    const { refundRequestId: requestId } = await request.json();
    refundRequestId = requestId;
    if (!refundRequestId) {
      return NextResponse.json(
        { error: "Missing refundRequestId" },
        { status: 400 }
      );
    }
    let newAppeovalID: string;
    const result = await prisma.$transaction(async (tx) => {
      // Load refund request
      const refundRequest = await tx.refundRequest.findUnique({
        where: { id: refundRequestId },
        include: {
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          requester: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!refundRequest) {
        throw new Error("Refund request not found");
      }

      if (refundRequest.status !== "PENDING") {
        throw new Error("Request is not pending");
      }

      // If system is paused, disallow approvals
      const paused = await isSystemPaused(tx);
      if (paused) {
        throw new Error(
          "System is paused. Cannot approve refund requests at this time."
        );
      }

      // Prevent self-approval
      if (refundRequest.requestedBy === session.user.id) {
        throw new Error("You cannot approve your own request");
      }

      // Check if user has already approved
      const existingApproval = await tx.refundApproval.findFirst({
        where: {
          refundRequestId,
          approvedBy: session.user.id,
        },
      });

      if (existingApproval) {
        throw new Error("You have already approved this request");
      }

      // Create approval record
      const approval = await tx.refundApproval.create({
        data: {
          refundRequestId,
          approvedBy: session.user.id,
        },
      });

      newAppeovalID = approval.id;

      await logActivity(tx, {
        action: ActivityAction.REFUND_REQUEST_APPROVE,
        metadata: {
          refundRequestId,
          approverId: session.user.id,
        },
      });

      // Check final approval count
      const approvalCount = await tx.refundApproval.count({
        where: { refundRequestId },
      });

      // If we have enough approvals, broadcast the transaction
      if (approvalCount === refundRequest.no_of_approvals) {
        await logActivity(tx, {
          action: ActivityAction.REFUND_REQUEST_FULLY_APPROVED,
          metadata: {
            refundRequestId,
            approvalCount,
          },
        });
        try {
          console.log("Starting refund broadcasting process for request:", refundRequestId);
          const { success, txid, error } = await broadcastRefundTransaction(refundRequest);
          console.log("Refund broadcast result:", { success, txid, error });

          if (error) {
            console.error("Refund broadcast failed with error:", error);
            throw new Error(`Refund broadcast failed: ${error}`);
          }

          if (!success) {
            console.error("Refund broadcast was not successful");
            throw new Error("Refund broadcast was not successful");
          }

          if (!txid) {
            console.error("No transaction ID returned from refund broadcast");
            throw new Error("No transaction ID returned from refund broadcast");
          }

          console.log("Updating refund request status to DONE");
          // Update with txid and mark as DONE
          const updatedRefund = await tx.refundRequest.update({
            where: { id: refundRequestId },
            data: {
              status: "REFUNDED",
              txid: txid,
              updatedAt: new Date(),
            },
          });

          await logActivity(tx, {
            action: ActivityAction.REFUND_TX_COMPLETED,
            metadata: {
              refundRequestId,
              txid,
              updatedRefund,
            },
          });

          emitrefundUpdate({
            activityId: refundRequestId,
            approval: "Refund Request Fully Approved",
            type: "APPROVED",
          });

          // Update any associated burn request
          const burnRequest = await tx.burnRequest.findFirst({
            where: {
              outpoint: refundRequest.outpoint,
              status: "PENDING",
            },
          });

          if (burnRequest) {
            await tx.burnRequest.update({
              where: { id: burnRequest.id },
              data: {
                status: "REFUNDED",
                updatedAt: new Date(),
              },
            });

            await logActivity(tx, {
              action: ActivityAction.BURN_REQUEST_REFUNDED,
              metadata: {
                burnRequestId: burnRequest.id,
                refundRequestId,
              },
            });

            await recordTransaction(tx, {
						requestId: refundRequestId || '',
						txid: txid,
						requestedBy: refundRequest.requestedBy,
						timestamp: new Date(),
						type: TransactionType.REFUND,
            approvers: refundRequest.approvals,
					})
          }

          console.log("Refund process completed successfully");
          return { status: "DONE", txid };
        } catch (error) {
          const refundError = error instanceof Error ? error.message : String(error || 'Unknown refund error');
          console.error("Error during refund broadcasting process:", {
            refundRequestId: refundRequestId || 'unknown',
            error: refundError,
            errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
            errorType: typeof error,
            errorName: error instanceof Error ? error.name : 'Unknown'
          });

          // Clean up the error message for user display
          const cleanErrorMessage = refundError.replace(/^Error:\s*/, "").replace(/^Refund operation failed:\s*/, "").replace(/^Refund broadcast failed:\s*/, "");
          throw new Error(cleanErrorMessage);
        }
      }

      console.log("Not enough approvals yet, staying in PENDING state");
      return { status: "PENDING" };
    }, { timeout: 60000 });

    // Emit Approved event
    const approvalWithUser = await prisma.refundApproval.findUnique({
      where: {
        id: newAppeovalID!,
      },
      include: {
        approver: true,
      },
    });
    emitrefundUpdate({
      activityId: refundRequestId,
      approval: approvalWithUser,
      type: "APPROVE",
    });

    console.log("Transaction completed successfully:", result);
    return NextResponse.json({
      success: true,
      message:
        result.status === "DONE"
          ? "Refund processed successfully"
          : "Approval recorded",
      status: result.status,
      ...(result.txid && { txid: result.txid }),
    });
  } catch (error) {
    // Ensure we have a proper error message to log
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error occurred');
    // Safely log error information without null values
    console.error("Error processing approval:", {
      refundRequestId: refundRequestId || 'unknown',
      error: errorMessage,
      errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
      errorType: typeof error,
      errorName: error instanceof Error ? error.name : 'Unknown'
    });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      {
        status:
          error instanceof Error &&
            (error.message.includes("will remain pending") ||
              error.message.includes("address is frozen"))
            ? 202
            : 500,
      },
    );
  }
}, createAPIRateLimit());
