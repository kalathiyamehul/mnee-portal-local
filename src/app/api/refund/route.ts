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
    const { burnRequestId, txid, vout } = await request.json();

    if (!burnRequestId || !txid || vout === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify burn request exists and is cancelled
    const burnRequest = await prisma.burnRequest.findUnique({
      where: { id: burnRequestId },
      include: {
        requester: true,
      },
    });

    if (!burnRequest) {
      return NextResponse.json(
        { error: "Burn request not found" },
        { status: 404 }
      );
    }

    if (burnRequest.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Burn request is not cancelled" },
        { status: 400 }
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

    // Add output back to the original requester's address
    tx.addOutput({
      lockingScript: new OrdP2PKH().lock(burnRequest.requester.address),
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

    // Update burn request status
    await prisma.burnRequest.update({
      where: { id: burnRequestId },
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