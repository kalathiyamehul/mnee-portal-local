import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction, Utils } from "@bsv/sdk";
import { BURN_WIF, MNEE_API } from "@/env";
import { fetchConfig, fetchTransaction, fetchTxo } from "@/utils/api";
import CosignTemplate from "@/templates/cosign";
import { applyInscription, type Inscription } from "js-1sat-ord";
import type { IndexContext } from "@/types/indexContext";
const { toBase64 } = Utils;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await fetchConfig();
  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  try {
    const { outpoint, refundAddress } = await request.json();

    if (!outpoint) {
      return NextResponse.json(
        { error: "Missing required field: outpoint" },
        { status: 400 }
      );
    }

    if (!refundAddress) {
      return NextResponse.json(
        { error: "Missing required field: refundAddress" },
        { status: 400 }
      );
    }

    const [sourceTXID, voutStr] = outpoint.split('_');
    const vout = Number.parseInt(voutStr, 10);

    if (!sourceTXID || Number.isNaN(vout)) {
      return NextResponse.json(
        { error: "Invalid outpoint format" },
        { status: 400 }
      );
    }

    // Find burn request by outpoint
    const burnRequest = await prisma.burnRequest.findFirst({
      where: {
        outpoint,
        status: 'PENDING'
      }
    });

    // Create refund transaction
    const burnPk = PrivateKey.fromWif(BURN_WIF);
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
    const txo = await fetchTxo(outpoint);
    const amount = txo.data.bsv21.amt;
    const cosignScript = new CosignTemplate().lock(refundAddress, PublicKey.fromString(config.approver));
    const inscriptionData = {
      p: "bsv-20",
      op: "transfer",
      id: config.tokenId,
      amt: amount.toString(),
    };
    const dataB64 = Buffer.from(JSON.stringify(inscriptionData)).toString(
      "base64",
    );
    const inscription = {
      dataB64,
      contentType: "application/bsv-20"
    } as Inscription
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

    if (burnRequest) {
      // Update burn request status to REFUNDED
      await prisma.burnRequest.update({
        where: { id: burnRequest.id },
        data: {
          status: "REFUNDED",
          updatedAt: new Date(),
        },
      });
    }

    const { txid } = await broadcastResponse.json() as IndexContext
    return NextResponse.json({
      success: true,
      message: "Refund transaction broadcast successfully",
      txid,
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refund" },
      { status: 500 }
    );
  }
} 