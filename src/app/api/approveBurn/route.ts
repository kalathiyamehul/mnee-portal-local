import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import { BURN_WIF, MNEE_API } from "@/env";
import { fetchConfig, fetchTransaction } from "@/utils/api";
import { applyInscription } from "js-1sat-ord";
import type { Inscription } from "js-1sat-ord";
import CosignTemplate from "@/templates/cosign";
import { Utils } from "@bsv/sdk";
const { toArray } = Utils;

export async function POST(request: Request) {
  try {
    console.log("Starting approveBurn route");
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      console.log("Unauthorized: No session or user ID");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("User authorized:", session.user.id);
    const { burnRequestId } = await request.json();
    console.log("Received burnRequestId:", burnRequestId);

    const result = await prisma.$transaction(async (tx) => {
      console.log("Starting database transaction");
      
      // Check if burn request exists and is pending
      const burnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: {
          approvals: true,
          requester: true,
        },
      });

      console.log("Found burn request:", burnRequest);

      if (!burnRequest) {
        console.log("Burn request not found");
        throw new Error("Burn request not found");
      }

      if (burnRequest.status !== "PENDING") {
        console.log("Invalid burn request status:", burnRequest.status);
        throw new Error("Burn request is not pending");
      }

      console.log("Checking system pause status");
      // Check if system is paused
      const pauseRequest = await tx.actionRequest.findFirst({
        where: {
          action: 'PAUSE',
          status: 'APPROVED',
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const resumeRequest = await tx.actionRequest.findFirst({
        where: {
          action: 'RESUME',
          status: 'APPROVED',
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      console.log("Pause request:", pauseRequest);
      console.log("Resume request:", resumeRequest);

      // System is paused if the latest approved PAUSE is more recent than the latest approved RESUME
      const isPaused = pauseRequest && (!resumeRequest || pauseRequest.createdAt > resumeRequest.createdAt);

      if (isPaused) {
        console.log("System is paused, cannot proceed");
        throw new Error("System is paused. Cannot approve burn requests at this time.");
      }

      // Check if user has already approved
      const hasApproved = burnRequest.approvals.some(
        (approval) => approval.approvedBy === session.user.id
      );

      if (hasApproved) {
        console.log("User has already approved this request");
        throw new Error("You have already approved this request");
      }

      // Prevent self-approval
      if (burnRequest.requestedBy === session.user.id) {
        console.log("User attempting to approve their own request");
        throw new Error("You cannot approve your own request");
      }

      console.log("Creating approval record");
      // Create approval
      await tx.burnApproval.create({
        data: {
          burnRequestId,
          approvedBy: session.user.id,
        },
      });

      console.log("Checking updated burn request status");
      // Update burn request status if enough approvals
      const updatedBurnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: { approvals: true },
      });

      console.log("Updated burn request:", updatedBurnRequest);
      console.log("Number of approvals:", updatedBurnRequest?.approvals.length);

      if (updatedBurnRequest?.approvals.length === 1) {
        console.log("Sufficient approvals received, proceeding with burn");
        
        // Use fetch config to get the approver from the remote service
        const remoteConfig = await fetchConfig();
        console.log("Remote config:", remoteConfig);

        if (!remoteConfig) {
          console.log("Remote Token configuration not found");
          throw new Error("Remote Token configuration not found");
        }

        if (!burnRequest.outpoint) {
          console.log("Burn request outpoint not found");
          throw new Error("Burn request outpoint not found");
        }

        // Parse outpoint to get txid and vout
        const [txid, voutStr] = burnRequest.outpoint.split('_');
        const vout = Number.parseInt(voutStr, 10);
        console.log("Parsed outpoint:", { txid, vout });

        if (!txid || Number.isNaN(vout)) {
          console.log("Invalid outpoint format");
          throw new Error("Invalid burn request outpoint");
        }

        // Fetch the specific UTXO we want to burn
        console.log("Fetching source transaction:", txid);
        const sourceTransaction = await fetchTransaction(txid);
        if (!sourceTransaction) {
          console.log("Failed to fetch source transaction");
          throw new Error("Failed to fetch source transaction");
        }
        console.log("Source transaction fetched successfully");

        // Add funding input and change output for transaction fees
        console.log("Initializing private key from WIF");
        const pk = PrivateKey.fromWif(BURN_WIF);

        // Build the burn transaction
        console.log("Building burn transaction");
        const burnTx = new Transaction();

        // Add the input UTXO we want to burn
        console.log("Adding burn input to transaction");
        burnTx.addInput({
          sourceTXID: txid,
          sourceOutputIndex: vout,
          sourceTransaction,
          unlockingScriptTemplate: new CosignTemplate().userUnlock(pk, "all", true),
        });

        // Add burn output
        console.log("Creating burn inscription");
        const burnInscriptionData = {
          p: "bsv-20",
          op: "burn",
          id: remoteConfig.tokenId,
          amt: burnRequest.amount.toString(),
        };
        console.log("Burn inscription data:", burnInscriptionData);
        
        const burnDataB64 = Buffer.from(JSON.stringify(burnInscriptionData)).toString("base64");
        console.log("Adding burn output to transaction", { remoteConfig });
        burnTx.addOutput({
          lockingScript: applyInscription(
            new CosignTemplate().lock(
              remoteConfig.burnAddress,
              PublicKey.fromString(remoteConfig.approver),
            ),
            {
              dataB64: burnDataB64,
              contentType: "application/bsv-20",
            } as Inscription,
          ),
          satoshis: 1,
        });

        console.log("Signing transaction");
        await burnTx.sign();
        console.log("Transaction signed successfully");

        // Cosigner needs to sign off
        console.log("Sending transaction for cosigning");
        const cosignResponse = await fetch(`${MNEE_API}/v1/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawtx: Buffer.from(burnTx.toHex(), "hex").toString("base64"),
          }),
        });

        if (!cosignResponse.ok) {
          const errorText = await cosignResponse.text();
          console.error("Cosign response error:", {
            status: cosignResponse.status,
            statusText: cosignResponse.statusText,
            body: errorText
          });

          // Try to parse the error message from the response
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              if (errorJson.message.includes("OP_EQUALVERIFY failed")) {
                throw new Error("Transaction verification failed. Please try again.");
              }
              throw new Error(errorJson.message);
            }
          } catch {
            // If we can't parse the error JSON, throw a generic error
            throw new Error("Failed to cosign burn transaction. Please try again.");
          }
        }

        console.log("Transaction cosigned successfully");
        const cosignResponseJson = (await cosignResponse.json()) as { rawtx: string };
        console.log("Parsing cosigned transaction");
        const cosignTx = Transaction.fromBinary(toArray(cosignResponseJson.rawtx, 'base64'));
        if (!cosignTx) {
          console.log("Failed to parse cosigned transaction");
          throw new Error("Failed to parse cosigned transaction");
        }

        console.log("Updating burn request status");
        // Update burn request status and save burn tx
        await tx.burnRequest.update({
          where: { id: burnRequestId },
          data: {
            status: "APPROVED",
            updatedAt: new Date(),
          },
        });

        console.log("Updating config with latest minter tx");
        // Update config with latest minter tx
        await tx.config.update({
          where: { id: 1 },
          data: { latestMinterTx: cosignTx.toHex() },
        });

        console.log("Burn transaction completed successfully");
        return { status: "APPROVED", burnTx: cosignTx.toHex() };
      }

      console.log("Not enough approvals yet, returning pending status");
      return { status: "PENDING" };
    });

    console.log("Transaction completed, returning response");
    return NextResponse.json({
      success: true,
      message: result.status === "APPROVED" ? "Burn request approved" : "Approval recorded",
      status: result.status,
      burnTx: result.burnTx,
    });
  } catch (error) {
    console.error("Error in approveBurn:", error);
    
    // Return a clean error message for the frontend
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }, { 
      status: 400  // Using 400 instead of 500 since these are usually validation/business logic errors
    });
  }
} 