import { NextResponse } from "next/server";
import {
	P2PKH,
	PrivateKey,
	Transaction,
	type TransactionInput,
	type TransactionOutput,
} from "@bsv/sdk";
import { getFundingUtxos } from "../approveMint/route";
import { fetchTransaction } from "@/utils/api";
import { MINT_FEE_WIF, MNEE_API, MNEE_ORDINALS_SERVICE } from "@/env";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";

export async function POST(request: Request) {
	try {
		const { symbol, amount, decimals } = await request.json();

		if (!symbol || !amount || decimals === undefined) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}
		const data = await deployMnee(amount, symbol, decimals);

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error deploying token:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to deploy token",
			},
			{ status: 500 },
		);
	}
}

type DeployRequest = {
	pubkey_issuer: string;
}

const deployMnee = async (amount: number, symbol: string, decimals: number) => {
	console.log("deploying mnee", { amount, symbol, decimals });


	const pk = PrivateKey.fromWif(MINT_FEE_WIF);
	const deployResponse = await fetch(`${MNEE_ORDINALS_SERVICE}/deploy`, {
		method: "POST",
		body: JSON.stringify({
			pubkey_issuer: pk.toPublicKey().toString(),
		} as DeployRequest),
	});

	if (!deployResponse.ok) {
		throw new Error("Failed to deploy MNEE");
	}

	const { minterTx } = await deployResponse.json();
	const tx = Transaction.fromHex(minterTx);

	const fundingAddress = pk.toAddress();
	const fundingUtxos = await getFundingUtxos(fundingAddress);
	for (const utxo of fundingUtxos) {
		tx.addInput({
			sourceTransaction: await fetchTransaction(utxo.txid),
			sourceTXID: utxo.txid,
			sourceOutputIndex: utxo.vout,
			unlockingScriptTemplate: new P2PKH().unlock(pk),
		} as TransactionInput);
	}

	tx.addOutput({
		change: true,
		lockingScript: new P2PKH().lock(fundingAddress),
	} as TransactionOutput);

	await tx.fee();

	await tx.sign();

	const deployTx = tx.toHex();

	// broadcast & ingest
	const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
		method: "POST",
		body: JSON.stringify({
			rawtx: Buffer.from(deployTx, "hex").toString("base64"),
		}),
	});

	if (!broadcastResponse.ok) {
		throw new Error("Failed to broadcast MNEE");
	}

	// save the new tx id to the db
	const dbConfig = await getConfig();
	if (dbConfig) {
		await prisma.config.update({
			where: { id: dbConfig.id },
			data: { latestMinterTx: deployTx },
		});
	}

	return { rawtx: deployTx };
};
