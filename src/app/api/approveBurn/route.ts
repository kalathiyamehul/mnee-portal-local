import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import { MINT_WIF, MNEE_API } from "@/env";
import { fetchTransaction } from "@/utils/api";
import { getConfig } from "@/lib/config";
import { applyInscription } from "js-1sat-ord";
import type { Inscription } from "js-1sat-ord";
import CosignTemplate from "@/templates/cosign";
import type { Config } from "@prisma/client";

export async function POST(request: Request) {
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
      
      // Get latest config
      const config = await getConfig(true) as Config & { approver: string };
      console.log("Retrieved config:", config);
      
      if (!config) {
        console.log("Token configuration not found");
        throw new Error("Token configuration not found");
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
      const pk = PrivateKey.fromWif(MINT_WIF);

      // Build the burn transaction
      console.log("Building burn transaction");
      const burnTx = new Transaction();

      // Add the input UTXO we want to burn
      console.log("Adding burn input to transaction");
      burnTx.addInput({
        sourceTXID: txid,
        sourceOutputIndex: vout,
        sourceTransaction,
        unlockingScriptTemplate: new CosignTemplate().userUnlock(pk),
      });

      // Add burn output
      console.log("Creating burn inscription");
      const burnInscriptionData = {
        p: "bsv-20",
        op: "burn",
        id: config.tokenId,
        amt: burnRequest.amount.toString(),
      };
      console.log("Burn inscription data:", burnInscriptionData);
      
      const burnDataB64 = Buffer.from(JSON.stringify(burnInscriptionData)).toString("base64");
      console.log("Adding burn output to transaction");
      burnTx.addOutput({
        lockingScript: applyInscription(
          new CosignTemplate().lock(
            config.burnAddress,
            PublicKey.fromString(config.approver),
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
        throw new Error("Failed to cosign burn transaction");
      }

      console.log("Transaction cosigned successfully");
      const cosignResponseJson = (await cosignResponse.json()) as { rawtx: string };
      console.log("Parsing cosigned transaction");
      const cosignTx = Transaction.fromHex(cosignResponseJson.rawtx);
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
} 