import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, Transaction } from "@bsv/sdk";
import { MINT_WIF, MNEE_API } from "@/env";
import { fetchTransaction } from "@/utils/api";
import { getConfig } from "@/lib/config";
import { OrdP2PKH } from "js-1sat-ord";
import { FundingUtxo } from "@/types/utxo";

// get funding UTXOs
async function getFundingUtxos(address: string) {
    const response = await fetch(`${MNEE_API}/v1/address/${address}/utxos`);
    if (!response.ok) {
        throw new Error('Failed to fetch UTXOs');
    }
    const utxos = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return utxos.filter((utxo: FundingUtxo) => !(utxo as any).data); // Filter out ordinal UTXOs
}

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
            const config = await getConfig(true);
            if (!config) {
                throw new Error("Token configuration not found");
            }

            // Create burn transaction
            const pk = PrivateKey.fromWif(MINT_WIF);
            const burnTx = new Transaction();

            // const burnConfig = {
            //   ordinals: [{
            //     txid: burnRequest.txid,
            //   } as Utxo]
            // } as BurnOrdinalsConfig;
            // burnOrdinals(burnConfig)
            // const burnAddress = "1";
            // Add burn inscription
            // burnTx.addOutput({
            //     script: new OrdP2PKH().lock(address, ),
            //     satoshis: 1,
            // });

            // Add funding input and change output
            const fundingAddress = pk.toAddress();
            const fundingUtxos = await getFundingUtxos(fundingAddress);
            
            for (const utxo of fundingUtxos) {
                burnTx.addInput({
                    sourceTransaction: await fetchTransaction(utxo.txid),
                    sourceTXID: utxo.txid,
                    sourceOutputIndex: utxo.vout,
                    unlockingScriptTemplate: new OrdP2PKH().unlock(pk),
                });
            }

            burnTx.addOutput({
                change: true,
                lockingScript: new OrdP2PKH().lock(fundingAddress),
            });

            await burnTx.fee();
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