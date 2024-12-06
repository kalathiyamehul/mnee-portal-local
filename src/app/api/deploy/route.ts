import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
	P2PKH,
	PrivateKey,
	Script,
	Transaction,
	TransactionInput,
	TransactionOutput,
} from "@bsv/sdk";
import { getFundingUtxos } from "../approveMint/route";
import { fetchTransaction } from "@/utils/api";
import { MINT_FEE_WIF } from "@/env";

export async function POST(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

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

const deployMnee = async (amount: number, symbol: string, decimals: number) => {
	const tx = new Transaction();

	const pk = PrivateKey.fromWif(MINT_FEE_WIF);
	const fundingAddress = pk.toAddress();

	const fundingUtxos = await getFundingUtxos(fundingAddress);
	const sourceTransaction = await fetchTransaction(fundingUtxos[0].txid);

	// add funding utxos to tx
	for (const utxo of fundingUtxos) {
		tx.addInput({
			sourceTransaction,
			sourceTXID: utxo.txid,
			sourceOutputIndex: utxo.vout,
			unlockingScriptTemplate: new P2PKH().unlock(pk),
		} as TransactionInput);
	}

	tx.addOutput({
		satoshis: 1,
		// lockingScript: new VauleLock(symbol).lockingScript,
	} as TransactionOutput);

	tx.addOutput({
		change: true,
		lockingScript: new P2PKH().lock(fundingAddress),
	} as TransactionOutput);

	await tx.fee();
  
	await tx.sign();

	return tx.toHex();
};
