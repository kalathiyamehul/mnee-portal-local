import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { P2PKH, PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import CosignTemplate from "@/templates/cosign";
import { getConfig } from "@/lib/config";
import { fetchConfig, fetchTransaction } from "@/utils/api";
import type { FundingUtxo, MintRequest } from "@/types/utxo";
import { MINT_WIF, MNEE_API, MNEE_ORDINALS_SERVICE } from "@/env";
import { signMint } from "@/templates/valut";

export async function POST(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { mintRequestId } = await request.json();

	const result = await prisma.$transaction(async (tx) => {
		// Verify the approving user exists
		const approvingUser = await tx.user.findUnique({
			where: { id: session.user.id },
		});

		if (!approvingUser) {
			throw new Error("Approving user not found");
		}

		// Fetch the mint request
		const mintRequest = await tx.mintRequest.findUnique({
			where: { id: mintRequestId },
			include: {
				requester: true,
				approvals: true,
			},
		});

		if (!mintRequest) {
			throw new Error("Mint request not found");
		}

		if (mintRequest.status !== "PENDING") {
			throw new Error("Request is not pending");
		}

		// Prevent self-approval
		if (mintRequest.requestedBy === session.user.id) {
			throw new Error("Cannot approve your own request");
		}

		// Check if the user has already approved
		const existingApproval = await tx.actionApproval.findFirst({
			where: {
				mintRequestId,
				approvedBy: session.user.id,
			},
		});

		if (existingApproval) {
			throw new Error("You have already approved this request");
		}

		// Create a new approval
		await tx.actionApproval.create({
			data: {
				mintRequestId,
				approvedBy: session.user.id,
			},
		});

		// Get updated approval count
		const approvalCount = await tx.actionApproval.count({
			where: { mintRequestId },
		});

		// If we now have 2 approvals (including the initial one), update the status
		if (approvalCount >= 2) {
			await tx.mintRequest.update({
				where: { id: mintRequestId },
				data: {
					status: "APPROVED",
					updatedAt: new Date(),
				},
			});

			const { rawtx } = await mintMnee(mintRequest.amount, mintRequest.address);

			// update the request status
			await tx.mintRequest.update({
				where: { id: mintRequestId },
				data: { status: "DONE", updatedAt: new Date() },
			});

			return { approvalCount, status: "DONE", minterTx: rawtx };
		}

		return { approvalCount, status: "PENDING" };
	});

	return NextResponse.json({
		success: true,
		message:
			result.status === "APPROVED" ? "Request approved" : "Approval recorded",
		approvalCount: result.approvalCount,
		status: result.status,
		minterTx: result.minterTx,
	});
}

const mintMnee = async (amount: number, address: string) => {
	const config = await fetchConfig();

	// create the cosign template
	const template = new CosignTemplate().lock(
		address,
		PublicKey.fromString(config.approver),
	);

	const token_ls = template.toHex();

	// look up latest_minter_tx
	const dbConfig = await getConfig();
	const latest_minter_tx = dbConfig?.latestMinterTx;

	if (!latest_minter_tx) {
		throw new Error("Latest minter tx not found");
	}

	// MNEE contract config
	const pk = PrivateKey.fromWif(MINT_WIF);
	const fundingAddress = pk.toAddress();
	const funding_utxos = await getFundingUtxos(fundingAddress);

	const fee_per_kb = 10;
	const change_addr = fundingAddress;

	const mintRequest: MintRequest = {
		amount,
		token_ls,
		latest_minter_tx,
		funding_utxos,
		fee_per_kb,
		change_addr,
	};

	console.log("Minting MNEE", amount, address, mintRequest);

	// mint the MNEE
	const mintResponse = await fetch(`${MNEE_ORDINALS_SERVICE}/mint`, {
		method: "POST",
		headers: {"Content-Type": "application/json"},
		body: JSON.stringify(mintRequest),
	});

	if (!mintResponse.ok) {
		const st = await mintResponse.text();
		throw new Error(
			`Failed to mint MNEE ${mintResponse.status}. Script template: ${st}`,
		);
	}

	try {
		const { minter_tx } = (await mintResponse.json()) as { minter_tx: string };

		const tx = Transaction.fromHex(minter_tx);

		// iterate over the inputs and set script template to p2pkh
		for (const input of tx.inputs) {
			if (!input.unlockingScript?.chunks.length) {
				input.sourceTransaction = await fetchTransaction(input.sourceTXID || '');
				input.unlockingScriptTemplate = new P2PKH().unlock(pk);
			}
		}

		// set the source transaction to the latest minter tx
		tx.inputs[0].sourceTransaction = Transaction.fromHex(latest_minter_tx);
		signMint(tx, 0, pk);
		await tx.sign();

		const rawtx = tx.toHex();
    
		// broadcast & ingest
		const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
			method: "POST",
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify({
				rawtx: Buffer.from(tx.toHex(), "hex").toString("base64"),
			}),
		});

		if (!broadcastResponse.ok) {
			throw new Error("Failed to broadcast MNEE");
		}
    
    // save the new tx id to the db
		console.log("saving db config");
		await prisma.config.update({
			where: { id: 1 },
			data: { latestMinterTx: rawtx },
		});

		return { rawtx };
	} catch (error) {
		console.error(error);
		throw new Error("Failed to mint MNEE");
	}
};

export const getFundingUtxos = async (fundingAddress: string) => {
	const utxosResponse = await fetch(`${MNEE_API}/v1/utxos/${fundingAddress}`);
	return (await utxosResponse.json()) as FundingUtxo[];
};
