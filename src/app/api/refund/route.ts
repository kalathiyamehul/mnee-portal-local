import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, Transaction } from "@bsv/sdk";
import { BURN_WIF, MNEE_API } from "@/env";
import { fetchTransaction } from "@/utils/api";
import { OrdP2PKH } from "js-1sat-ord";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const [txid, voutStr] = outpoint.split('_');
    const vout = Number.parseInt(voutStr, 10);

    if (!txid || Number.isNaN(vout)) {
      return NextResponse.json(
        { error: "Invalid outpoint format" },
        { status: 400 }
      );
    }

    // Find burn request by outpoint
    const burnRequest = await prisma.burnRequest.findFirst({
      where: { 
        outpoint,
        status: 'CANCELLED'
      }
    });

    if (!burnRequest) {
      return NextResponse.json(
        { error: "No cancelled burn request found for this outpoint" },
        { status: 404 }
      );
    }

    // Create refund transaction
    const burnPk = PrivateKey.fromWif(BURN_WIF);
    const tx = new Transaction();

    // Add input from burn address
    const sourceTransaction = await fetchTransaction(txid);
    tx.addInput({
      sourceTXID: txid,
      sourceOutputIndex: vout,
      sourceTransaction,
      unlockingScriptTemplate: new OrdP2PKH().unlock(burnPk),
    });

    // Add output to the refund address
    tx.addOutput({
      lockingScript: new OrdP2PKH().lock(refundAddress),
      satoshis: 1,
    });

    await tx.fee();
    await tx.sign();

    // Broadcast transaction
    const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawtx: Buffer.from(tx.toHex(), "hex").toString("base64"),
      }),
    });

    if (!broadcastResponse.ok) {
      throw new Error("Failed to broadcast refund transaction");
    }

    // Update burn request status to REFUNDED
    await prisma.burnRequest.update({
      where: { id: burnRequest.id },
      data: {
        status: "REFUNDED",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Refund transaction broadcast successfully",
      txid: tx.id('hex'),
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refund" },
      { status: 500 }
    );
  }
} 