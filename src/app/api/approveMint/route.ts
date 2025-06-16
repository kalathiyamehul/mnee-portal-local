import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import {
	fetchConfig,
	fetchVaultedMneeUtxos,
} from "@/utils/api";
import { getMintWif, MNEE_API } from "@/env";
import { getFundingUtxos } from "@/utils/utxo";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import type { Prisma } from "@prisma/client";
import {
	type Distribution,
	TokenType,
	type TokenUtxo,
	transferOrdTokens,
	type TransferOrdTokensConfig,
} from "js-1sat-ord";
import CosignTemplate from "@/templates/cosign";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { emitMintUpdate } from "@/lib/sseEmitter";

type MintRequestWithRelations = Prisma.MintRequestGetPayload<{
	include: {
		requester: true;
		approvals: true;
	};
}>;

export const POST =  withCSRF(async function(request: Request) {
	console.log("Starting approveMint request");
	const session = await getServerSession(authOptions);
	console.log("Session:", { userId: session?.user?.id });

	if (!session?.user?.id) {
		console.log("Unauthorized: No session or user ID");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let mintRequestId: string | undefined;

	try {
		const { mintRequestId: requestId } = await request.json();
		mintRequestId = requestId;
		const result: any = await prisma.$transaction(async (tx) => {
			const approvingUser = await tx.user.findUnique({
				where: { id: session.user.id },
			});
			if (!approvingUser) {
				throw new Error("Approving user not found");
			}
			const mintRequest = (await tx.mintRequest.findUnique({
				where: { id: mintRequestId },
				include: {
					requester: true,
					approvals: true,
				},
			})) as MintRequestWithRelations;
			if (!mintRequest) {
				throw new Error("Mint request not found");
			}
			if (mintRequest.status !== "PENDING") {
				throw new Error("Request is not pending");
			}
			if (mintRequest.amount <= 0n) {
				throw new Error("Mint amount must be greater than 0");
			}
			const systemCheck = await performSystemChecks(tx, {
				address: mintRequest.address,
				operation: SystemOperation.MINT_REQUEST_APPROVE,
			});
			if (!systemCheck.isValid) {
				// If system is paused, keep the request pending
				if (systemCheck.error?.includes("System is paused")) {
					return NextResponse.json(
						{
							success: false,
							error:
								"System is paused. Request will remain pending until system is unpaused.",
						},
						{ status: 202 },
					);
				}

				// For other errors (like blacklist), return error
				return NextResponse.json(
					{
						success: false,
						error: systemCheck.error,
					},
					{ status: 400 },
				);
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
			// Create approval
			const approval = await tx.actionApproval.create({
				data: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			await logActivity(tx, {
				action: ActivityAction.MINT_REQUEST_APPROVE,
				metadata: {
					mintRequestId,
				},
			});

			// Check if we have enough approvals
			const approvalsCount = await tx.actionApproval.count({
				where: { mintRequestId },
			});
			if (approvalsCount === mintRequest.no_of_approvals) {
				// Update request status to APPROVED
				await tx.mintRequest.update({
					where: { id: mintRequestId },
					data: { status: "APPROVED" },
				});

				await logActivity(tx, {
					action: ActivityAction.MINT_REQUEST_FULLY_APPROVED,
					metadata: {
						mintRequestId,
						approvalsCount,
					},
				});

				try {
					const { rawtx, error, success } = await mintMnee(
						mintRequest.amount,
						mintRequest.address,
					);

					if (!success) {
						throw new Error(error);
					}

					const mintedRequest = await tx.mintRequest.update({
						where: { id: mintRequestId },
						data: {
							status: "DONE",
							updatedAt: new Date(),
							txid: Transaction.fromHex(rawtx).id("hex"),
						},
					});

					await logActivity(tx, {
						action: ActivityAction.MINT_TX_COMPLETED,
						metadata: {
							mintRequestId,
							txid: Transaction.fromHex(rawtx).id("hex"),
						},
					});

					emitMintUpdate({
						activityId: requestId,
						approval: mintedRequest,
						type: "APPROVED",
					});

					return { status: "DONE", approvalsCount, minterTx: rawtx, approval };
				} catch (error) {
					console.error("Error during minting:", error);
					const errorMessage =
						error instanceof Error
							? error.message.replace(/^Error:\s*/, "")
							: "Transaction submission failed";
					throw new Error(errorMessage);
				}
			}

			console.log("Not enough approvals yet, staying in PENDING state");
			return { status: "PENDING", approvalsCount, approval };
		});
		const approval = await prisma.actionApproval.findUnique({
			where: {
				id: result.approval.id,
			},
			include: {
				approver: true,
			},
		});
		emitMintUpdate({
			activityId: requestId,
			approval: approval,
			type: "APPROVE",
		});
		console.log("Transaction completed successfully:", result);
		return NextResponse.json({
			success: true,
			message:
				result.status === "APPROVED" ? "Request approved" : "Approval recorded",
		});
	} catch (error) {
		console.error("Error processing approval:", error);
		return NextResponse.json(
			{
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to process approval",
			},
			{
				status:
					error instanceof Error &&
					(error.message.includes("will remain pending") ||
						error.message.includes("address is frozen"))
						? 202
						: 500,
			},
		);
	}
}, createAPIRateLimit())

// Helper function to mint MNEE tokens
const mintMnee = async (
	amount: bigint,
	address: string,
): Promise<{ success: boolean; rawtx: string; error?: string }> => {
	console.log("Starting mintMnee:", { amount: amount.toString(), address });
  // Fetching remote config
	const config = await fetchConfig();
	console.log("Fetched remote config:", { approver: config.approver });

	// MNEE contract config
	const pk = PrivateKey.fromWif(await getMintWif());
	const fundingAddress = pk.toAddress();
	const funding_utxos = await getFundingUtxos(fundingAddress);
	console.log("Got funding UTXOs:", { count: funding_utxos.length });
	console.log("Funding UTXOs:", funding_utxos);

	if (!funding_utxos.length) {
		throw new Error("No funding UTXOs available");
	}

	const change_addr = fundingAddress;
	console.log("Change address:", change_addr);

	const vaultTokens = await fetchVaultedMneeUtxos();
	const inputTokens = vaultTokens.map((token) => ({
		txid: token.txid,
		vout: token.vout,
		satoshis: 1,
		amt: token.data.bsv21.amt.toString(),
		id: token.data.bsv21.id,
		script: token.script,
	})) as TokenUtxo[];

	const distributions = [
		{
			address: new CosignTemplate().lock(address, PublicKey.fromString(config.approver)),
      // This is already in sats format so we pass 0 decimals as a hack below
			tokens: Number(amount),
		},
	] as Distribution[];

	const changeAddress = fundingAddress;
	const transferConfig = {
		protocol: TokenType.BSV21,
		tokenID: config.tokenId,
    // We do not want 1sat to convert this again its already in sats format
		decimals: 0,
		utxos: funding_utxos,
		inputTokens,
		distributions,
		paymentPk: pk,
		ordPk: pk,
		changeAddress,
		tokenChangeAddress: changeAddress,
	} as TransferOrdTokensConfig;

  console.log({transferConfig})
  let rawtx = "";
  
  try {
    const mintResponse = await transferOrdTokens(transferConfig);

    if (!mintResponse || !mintResponse.tx) {
      // return an error without throwing
      return {
        success: false,
        error: "Failed to mint MNEE",
        rawtx: "",
      };
    }

    const { tx } = mintResponse;
    console.log("Signed transaction");

     rawtx = tx.toHex();
  } catch (error) {
    console.error("Error during mint process:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      rawtx: "",
    };
  }
	

	try {


		// broadcast & ingest
		console.log("Broadcasting transaction");
		const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				rawtx: Buffer.from(rawtx, "hex").toString("base64"),
			}),
		});

		if (!broadcastResponse.ok) {
			const broadcastError = await broadcastResponse.text();
			console.error("Broadcast failed:", broadcastError);

			// Check if it's a double-spend error
			try {
				const errorJson = JSON.parse(broadcastError);
				if (errorJson.message?.includes("double-spend")) {
					console.log("Transaction was already broadcast");
					// Don't throw - the transaction is already on chain
					return { rawtx, success: true };
				}
			} catch (e) {
				// If we can't parse the error, just continue with the normal error flow
			}

			return {
				success: false,
				error: broadcastError,
				rawtx: "",
			};
		}

		// save the new tx id to the db
		try {
			console.log("Updating config with latest minter tx");
			await prisma.config.update({
				where: { id: 1 },
				data: { latestMinterTx: rawtx },
			});
		} catch (configError) {
			console.error(
				"Failed to update config with latest minter tx:",
				configError,
			);
			// Don't throw here - the mint was successful, we just couldn't update the config
			// This will be handled in the next mint attempt
		}

		return { success: true, rawtx };
	} catch (error) {
		console.error("Error during mint process:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
			rawtx: "",
		};
	}
};
