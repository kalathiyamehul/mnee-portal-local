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

export const DEFAULT_FEES = [
	{ min: 0, max: 10000, fee: 50 },
	{ min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 },
  ];

export async function POST(request: Request) {
	console.log("deploying token");
	try {
		const { symbol, amount, decimals, feeAddress } = await request.json();

		if (!symbol || !amount || decimals === undefined) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}
		const data = await deployMnee(feeAddress, amount, symbol, decimals);

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

const deployMnee = async (feeAddress: string, amount: number, symbol: string, decimals: number) => {
	console.log("deploying mnee", { feeAddress, amount, symbol, decimals });

	const pk = PrivateKey.fromWif(MINT_FEE_WIF);
	const deployResponse = await fetch(`${MNEE_ORDINALS_SERVICE}/deploy`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			pubkey_issuer: pk.toPublicKey().toString(),
		} as DeployRequest),
	});

	if (!deployResponse.ok) {
		console.error(deployResponse.status, await deployResponse.text());
		throw new Error("Failed to deploy MNEE");
	}

	const { minter_tx } = await deployResponse.json();
	const tx = Transaction.fromHex(minter_tx);

	const fundingAddress = pk.toAddress();
	const fundingUtxos = await getFundingUtxos(fundingAddress);
	console.log("funding utxos", fundingUtxos);
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
	const deployTxid = tx.id('hex');
	const tokenId = `${deployTxid}_0`;

	// broadcast & ingest
	console.log("broadcasting mnee", deployTx);
	const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			rawtx: Buffer.from(deployTx, "hex").toString("base64"),
		}),
	});

	if (!broadcastResponse.ok) {
		throw new Error("Failed to broadcast MNEE");
	}

	console.log("broadcasted mnee", deployTxid);
	// save the new tx id to the db
	// const dbConfig = await getConfig();
	// if (dbConfig) {
		await prisma.config.upsert({
			where: { id: 1 },
			update: { tokenId, feeAddress, fees: DEFAULT_FEES, decimals, latestMinterTx: deployTx },
			create: { id: 1, tokenId, feeAddress, fees: DEFAULT_FEES, decimals, latestMinterTx: deployTx },
		});
	// }

	return { rawtx: deployTx };
};
