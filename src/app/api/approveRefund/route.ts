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
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
const { toBase64 } = Utils;

async function broadcastRefundTransaction(refundRequest: RefundRequest) {
  const config = await fetchConfig();
  if (!config) {
    throw new Error("Config not found");
  }

  const [sourceTXID, voutStr] = refundRequest.outpoint.split('_');
  const vout = Number.parseInt(voutStr, 10);

  if (!sourceTXID || Number.isNaN(vout)) {
    throw new Error("Invalid outpoint format");
  }

  // Create refund transaction
  const burnPk = PrivateKey.fromWif(await getBurnWif());
  const tx = new Transaction();

  // Add input from burn address
  const sourceTransaction = await fetchTransaction(sourceTXID);
  tx.addInput({
    sourceTXID,
    sourceOutputIndex: vout,
    sourceTransaction,
    unlockingScriptTemplate: new CosignTemplate().userUnlock(burnPk, "all", true),
  });

  // get the parsed MNEEUtxo for the amount
  const txo = await fetchTxo(refundRequest.outpoint);
  const amount = txo.data.bsv21.amt;
  const cosignScript = new CosignTemplate().lock(refundRequest.refundAddress, PublicKey.fromString(config.approver));
  const inscriptionData = {
    p: "bsv-20",
    op: "transfer",
    id: config.tokenId,
    amt: amount.toString(),
  };
  const dataB64 = Buffer.from(JSON.stringify(inscriptionData)).toString("base64");
  const inscription = {
    dataB64,
    contentType: "application/bsv-20"
  } as Inscription;
  const lockingScript = applyInscription(cosignScript, inscription);
  
  // Add output to the refund address
  tx.addOutput({
    lockingScript,
    satoshis: 1,
  });

  await tx.fee();
  await tx.sign();

  // Broadcast transaction
  const broadcastResponse = await fetch(`${MNEE_API}/v1/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rawtx: toBase64(tx.toBinary()),
    }),
  });

  if (!broadcastResponse.ok) {
    throw new Error("Failed to broadcast refund transaction");
  }

  const { txid } = await broadcastResponse.json() as IndexContext;
  return txid;
}

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { refundRequestId } = await request.json();
  if (!refundRequestId) {
    return NextResponse.json({ error: "Missing refundRequestId" }, { status: 400 });
  }

  try {
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
                  name: true
                }
              }
            }
          },
          requester: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
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
        throw new Error("System is paused. Cannot approve refund requests at this time.");
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
        }
      });

      if (existingApproval) {
        throw new Error("You have already approved this request");
      }

      // Create approval record
      const approval = await tx.refundApproval.create({
        data: {
          refundRequestId,
          approvedBy: session.user.id
        }
      });

      await logActivity(tx, {
        name: "Refund Request Approved",
        action: "REFUND_REQUEST_APPROVE",
        description: `Refund request ${refundRequestId} approved by user ${session.user.email}`,
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
        try {
          const txid = await broadcastRefundTransaction(refundRequest);

          // Update with txid and mark as DONE
          const updatedRefund = await tx.refundRequest.update({
            where: { id: refundRequestId },
            data: {
              status: "DONE",
              txid,
              updatedAt: new Date(),
            }
          });

          await logActivity(tx, {
            name: "Refund Request Fully Approved",
            action: "REFUND_REQUEST_FULLY_APPROVED",
            description: `Refund request ${refundRequestId} fully approved and transaction broadcasted`,
            metadata: {
              refundRequestId,
              txid,
            },
          });

          // Update any associated burn request
          const burnRequest = await tx.burnRequest.findFirst({
            where: {
              outpoint: refundRequest.outpoint,
              status: "PENDING"
            }
          });

          if (burnRequest) {
            const updatedBurn = await tx.burnRequest.update({
              where: { id: burnRequest.id },
              data: {
                status: "REFUNDED",
                updatedAt: new Date(),
              }
            });

            await logActivity(tx, {
              name: "Burn Request Refunded",
              action: "BURN_REQUEST_REFUNDED",
              description: `Burn request ${burnRequest.id} marked as REFUNDED due to refund approval`,
              metadata: {
                burnRequestId: burnRequest.id,
                refundRequestId,
              },
            });
          }

          return { status: "DONE", txid };
        } catch (error) {
          // If broadcasting fails, keep as APPROVED
          console.error("Failed to broadcast refund:", error);
          return { status: "APPROVED", error: error instanceof Error ? error.message : "Failed to broadcast" };
        }
      }

      return { status: "PENDING" };
    });

    return NextResponse.json({
      success: true,
      message: result.status === "DONE" 
        ? "Refund processed successfully" 
        : result.status === "APPROVED" 
          ? "Refund approved but failed to broadcast" 
          : "Approval recorded",
      status: result.status,
      ...(result.txid && { txid: result.txid }),
      ...(result.error && { error: result.error })
    });
  } catch (error) {
    console.error("Error processing approval:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process approval"
    }, { status: 500 });
  }
})