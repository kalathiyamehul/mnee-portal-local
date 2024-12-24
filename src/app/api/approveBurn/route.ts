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
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { burnRequestId } = await request.json();

  const result = await prisma.$transaction(async (tx) => {
    // Check if burn request exists and is pending
    const burnRequest = await tx.burnRequest.findUnique({
      where: { id: burnRequestId },
      include: {
        approvals: true,
        requester: true,
      },
    });

    if (!burnRequest) {
      throw new Error("Burn request not found");
    }

    if (burnRequest.status !== "PENDING") {
      throw new Error("Burn request is not pending");
    }

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

    // System is paused if the latest approved PAUSE is more recent than the latest approved RESUME
    const isPaused = pauseRequest && (!resumeRequest || pauseRequest.createdAt > resumeRequest.createdAt);

    if (isPaused) {
      throw new Error("System is paused. Cannot approve burn requests at this time.");
    }

    // Check if user has already approved
    const hasApproved = burnRequest.approvals.some(
      (approval) => approval.approvedBy === session.user.id
    );

    if (hasApproved) {
      throw new Error("You have already approved this request");
    }

    // Prevent self-approval
    if (burnRequest.requestedBy === session.user.id) {
      throw new Error("You cannot approve your own request");
    }

    // Create approval
    await tx.burnApproval.create({
      data: {
        burnRequestId,
        approvedBy: session.user.id,
      },
    });

    // Update burn request status if enough approvals
    const updatedBurnRequest = await tx.burnRequest.findUnique({
      where: { id: burnRequestId },
      include: { approvals: true },
    });

    if (updatedBurnRequest?.approvals.length === 1) {
      // Get latest config
      const config = await getConfig(true) as Config & { approver: string };
      if (!config) {
        throw new Error("Token configuration not found");
      }

      if (!burnRequest.outpoint) {
        throw new Error("Burn request outpoint not found");
      }

      // Parse outpoint to get txid and vout
      const [txid, voutStr] = burnRequest.outpoint.split('_');
      const vout = Number.parseInt(voutStr, 10);

      if (!txid || Number.isNaN(vout)) {
        throw new Error("Invalid burn request outpoint");
      }

      // Fetch the specific UTXO we want to burn
      const sourceTransaction = await fetchTransaction(txid);
      if (!sourceTransaction) {
        throw new Error("Failed to fetch source transaction");
      }

      // Add funding input and change output for transaction fees
      const pk = PrivateKey.fromWif(MINT_WIF);

      // Build the burn transaction
      const burnTx = new Transaction();

      // Add the input UTXO we want to burn
      burnTx.addInput({
        sourceTXID: txid,
        sourceOutputIndex: vout,
        sourceTransaction,
        unlockingScriptTemplate: new CosignTemplate().userUnlock(pk),
      });

      // Add burn output
      const burnInscriptionData = {
        p: "bsv-20",
        op: "burn",
        id: config.tokenId,
        amt: burnRequest.amount.toString(),
      };
      const burnDataB64 = Buffer.from(JSON.stringify(burnInscriptionData)).toString("base64");
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

      await burnTx.sign();

      // Broadcast transaction
      const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawtx: Buffer.from(burnTx.toHex(), "hex").toString("base64"),
        }),
      });

      if (!broadcastResponse.ok) {
        throw new Error("Failed to broadcast burn transaction");
      }

      // Update burn request status and save burn tx
      await tx.burnRequest.update({
        where: { id: burnRequestId },
        data: {
          status: "APPROVED",
          updatedAt: new Date(),
        },
      });

      // Update config with latest minter tx
      await tx.config.update({
        where: { id: 1 },
        data: { latestMinterTx: burnTx.toHex() },
      });

      return { status: "APPROVED", burnTx: burnTx.toHex() };
    }

    return { status: "PENDING" };
  });

  return NextResponse.json({
    success: true,
    message: result.status === "APPROVED" ? "Burn request approved" : "Approval recorded",
    status: result.status,
    burnTx: result.burnTx,
  });
} 