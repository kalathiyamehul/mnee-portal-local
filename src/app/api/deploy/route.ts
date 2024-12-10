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
import { MINT_WIF, BURN_WIF, MNEE_API, MNEE_ORDINALS_SERVICE } from "@/env";
import { prisma } from "@/lib/prisma";
import type { IndexContext } from "@/types/indexContext";

const DEFAULT_FEES = [
	{ min: 0, max: 10000, fee: 50 },
	{ min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 },
  ];

export async function POST(request: Request) {
	console.log("deploying token");
	try {
		const { feeAddress } = await request.json();

		if (!feeAddress) {
			return NextResponse.json(
				{ success: false, error: "Fee address is required" },
				{ status: 400 },
			);
		}

		const result = await deployMnee(feeAddress);
		return NextResponse.json({ success: true, ...result });
	} catch (error) {
		console.error("Error deploying token:", error);
		return NextResponse.json(
			{ 
				success: false,
				error: error instanceof Error ? error.message : "Failed to deploy token"
			},
			{ status: 500 },
		);
	}
}

type DeployRequest = {
	pubkey_issuer: string;
}

const deployMnee = async (feeAddress: string) => {
	console.log("deploying mnee", { feeAddress });

	try {
		const mintPk = PrivateKey.fromWif(MINT_WIF);
		const burnPk = PrivateKey.fromWif(BURN_WIF);
		const mintAddress = mintPk.toAddress();
		const burnAddress = burnPk.toAddress();

		const deployResponse = await fetch(`${MNEE_ORDINALS_SERVICE}/deploy`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				pubkey_issuer: mintPk.toPublicKey().toString(),
			} as DeployRequest),
		});

		if (!deployResponse.ok) {
			const errorText = await deployResponse.text();
			console.error(deployResponse.status, errorText);
			throw new Error("Failed to deploy MNEE");
		}

		const { minter_tx } = await deployResponse.json();
		if (!minter_tx) {
			throw new Error("Invalid response from deploy service");
		}

		const tx = Transaction.fromHex(minter_tx);
		const fundingAddress = mintPk.toAddress();
		const fundingUtxos = await getFundingUtxos(fundingAddress);
		
		console.log("funding utxos", fundingUtxos);
		for (const utxo of fundingUtxos) {
			tx.addInput({
				sourceTransaction: await fetchTransaction(utxo.txid),
				sourceTXID: utxo.txid,
				sourceOutputIndex: utxo.vout,
				unlockingScriptTemplate: new P2PKH().unlock(mintPk),
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

    const data = await broadcastResponse.json() as IndexContext;
    const token = data.txos[0].data.bsv21;

		console.log("broadcasted mnee", deployTxid, token);
		
		// Create config data object
		const configData = {
			tokenId, 
			feeAddress, 
			fees: DEFAULT_FEES, 
			decimals: token.dec, 
			latestMinterTx: deployTx,
			mintAddress,
			burnAddress,
			fundAddress: "",
		};

		// Update config
		try {
			await prisma.config.upsert({
				where: { id: 1 },
				update: configData,
				create: { 
					id: 1,
					...configData,
				},
			});
		} catch (error) {
			console.error("Failed to update config:", error);
			// Even if config update fails, return deployment info
			return { 
				tokenId,
				decimals: token.dec,
				deployTx,
				deployTxid,
				configError: "Failed to save configuration"
			};
		}

		return { 
			tokenId,
			decimals: token.dec,
			deployTx,
			deployTxid
		};
	} catch (error) {
		console.error("Deploy error:", error);
		throw error;
	}
};
