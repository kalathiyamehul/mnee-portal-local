import { NextResponse } from "next/server";
import { PrivateKey } from "@bsv/sdk";
import { getMintWif, getBurnWif, MNEE_API } from "@/env";
import { prisma } from "@/lib/prisma";
import type { IndexContext } from "@/types/indexContext";
import { getFundingUtxos } from "@/utils/utxo";
import { deployBsv21Token, type DeployBsv21TokenConfig } from "js-1sat-ord";
import {
  MNEE_TOKEN_DEC,
	MNEE_TOKEN_ICON,
	MNEE_TOKEN_MAX,
	MNEE_TOKEN_SYM,
} from "@/lib/constants";

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
				error:
					error instanceof Error ? error.message : "Failed to deploy token",
			},
			{ status: 500 },
		);
	}
}

const deployMnee = async (feeAddress: string) => {
	try {
		const mintPk = PrivateKey.fromWif(getMintWif());
		const burnPk = PrivateKey.fromWif(getBurnWif());
		const mintAddress = mintPk.toAddress();
		const burnAddress = burnPk.toAddress();

		const fundingAddress = mintPk.toAddress();
		const fundingUtxos = await getFundingUtxos(fundingAddress);

		console.log("funding utxos", fundingUtxos);

		const config: DeployBsv21TokenConfig = {
			symbol: MNEE_TOKEN_SYM,
			icon: MNEE_TOKEN_ICON,
			utxos: fundingUtxos,
			initialDistribution: { address: mintAddress, tokens: MNEE_TOKEN_MAX },
			paymentPk: mintPk,
			destinationAddress: mintAddress,
			decimals: MNEE_TOKEN_DEC,
		};

		const result = await deployBsv21Token(config);

		const { tx } = result;

		const deployTx = tx.toHex();
		const deployTxid = tx.id("hex");
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

		const data = (await broadcastResponse.json()) as IndexContext;
		const token = data.txos[0].data.bsv21;

		console.log("broadcasted mnee", deployTxid, token, JSON.stringify(data));

		// Create config data object
		const configData = {
			tokenId,
			feeAddress,
			fees: DEFAULT_FEES,
			decimals: token.dec,
			latestMinterTx: deployTx,
			mintAddress,
			burnAddress,
		};

		// Update config
		try {
			await prisma.config.upsert({
				where: { id: 1 },
				update: configData,
				create: {
					id: 1,
					...configData,
					fundAddress: "",
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
				configError: "Failed to save configuration",
			};
		}

		return {
			tokenId,
			decimals: token.dec,
			deployTx,
			deployTxid,
		};
	} catch (error) {
		console.error("Deploy error:", error);
		throw error;
	}
};
