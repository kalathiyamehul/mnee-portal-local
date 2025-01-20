import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import {
	fetchConfig,
	fetchVaultedMneeUtxos,
} from "@/utils/api";
import { MINT_WIF, MNEE_API } from "@/env";
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

type MintRequestWithRelations = Prisma.MintRequestGetPayload<{
	include: {
		requester: true;
		approvals: true;
	};
}>;

export async function POST(request: Request) {
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
		console.log("Processing mint request:", { mintRequestId });

		const result = await prisma.$transaction(async (tx) => {
			// Verify the approving user exists
			console.log("Verifying approving user:", { userId: session.user.id });
			const approvingUser = await tx.user.findUnique({
				where: { id: session.user.id },
			});

			if (!approvingUser) {
				console.log("Approving user not found");
				throw new Error("Approving user not found");
			}

			// Fetch the mint request
			console.log("Fetching mint request");
			const mintRequest = (await tx.mintRequest.findUnique({
				where: { id: mintRequestId },
				include: {
					requester: true,
					approvals: true,
				},
			})) as MintRequestWithRelations;
			console.log("Found mint request:", {
				requestId: mintRequest?.id,
				status: mintRequest?.status,
				requesterId: mintRequest?.requestedBy,
				approvalCount: mintRequest?.approvals.length,
			});

			if (!mintRequest) {
				console.log("Mint request not found");
				throw new Error("Mint request not found");
			}

			if (mintRequest.status !== "PENDING") {
				console.log("Invalid status:", { status: mintRequest.status });
				throw new Error("Request is not pending");
			}

			if (mintRequest.amount <= 0n) {
				console.log("Invalid amount:", {
					amount: mintRequest.amount.toString(),
				});
				throw new Error("Mint amount must be greater than 0");
			}

			// Check if system is paused and address is not blacklisted
			console.log(
				"Checking system status and blacklist for address:",
				mintRequest.address,
			);
			const systemCheck = await performSystemChecks(tx, {
				address: mintRequest.address,
				operation: SystemOperation.MINT_REQUEST_APPROVE,
			});
			if (!systemCheck.isValid) {
				console.log("System check failed:", systemCheck.error);

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
			console.log("Checking for self-approval:", {
				requesterId: mintRequest.requestedBy,
				approverId: session.user.id,
			});
			if (mintRequest.requestedBy === session.user.id) {
				console.log("Self-approval attempt detected");
				throw new Error("Cannot approve your own request");
			}

			// Check if the user has already approved
			console.log("Checking for existing approval");
			const existingApproval = await tx.actionApproval.findFirst({
				where: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			if (existingApproval) {
				console.log("User has already approved");
				throw new Error("You have already approved this request");
			}

			// Check if the target address is frozen
			console.log("Checking freeze status for address:", mintRequest.address);
			const freezeRequest = await tx.freezeRequest.findFirst({
				where: {
					address: mintRequest.address,
					status: "APPROVED",
				},
				orderBy: {
					createdAt: "desc",
				},
			});

			if (freezeRequest?.action === "FREEZE") {
				console.log("Address is frozen");
				return NextResponse.json(
					{
						success: false,
						error:
							"Address is frozen. Request will remain pending until address is unfrozen.",
					},
					{ status: 202 },
				);
			}

			// Create approval
			console.log("Creating approval");
			await tx.actionApproval.create({
				data: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			// Check if we have enough approvals
			console.log("Checking approval count");
			const approvalsCount = await tx.actionApproval.count({
				where: { mintRequestId },
			});
			console.log("Current approval count:", approvalsCount);

			if (approvalsCount === 2) {
				console.log("Required approvals reached, updating status to APPROVED");
				// Update request status to APPROVED
				await tx.mintRequest.update({
					where: { id: mintRequestId },
					data: { status: "APPROVED" },
				});

				try {
					console.log("Starting MNEE mint process");
					const { rawtx, error, success } = await mintMnee(
						mintRequest.amount,
						mintRequest.address,
					);
					console.log("MNEE mint successful, updating request status");

					if (!success) {
						throw new Error(error);
					}

					// update the request status and txid
					await tx.mintRequest.update({
						where: { id: mintRequestId },
						data: {
							status: "DONE",
							updatedAt: new Date(),
							txid: Transaction.fromHex(rawtx).id("hex"),
						},
					});

					return { status: "DONE", approvalsCount, minterTx: rawtx };
				} catch (error) {
					// If minting fails, propagate the error
					console.error("Error during minting:", error);
					const errorMessage =
						error instanceof Error
							? error.message.replace(/^Error:\s*/, "") // Remove "Error: " prefix
							: "Transaction submission failed";

					throw new Error(errorMessage);
				}
			}

			console.log("Not enough approvals yet, staying in PENDING state");
			return { status: "PENDING", approvalsCount };
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
}

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
	const pk = PrivateKey.fromWif(MINT_WIF);
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
		// decimals: Number(config.decimals),
		utxos: funding_utxos,
		inputTokens,
		distributions,
		paymentPk: pk,
		ordPk: pk,
		changeAddress,
		tokenChangeAddress: changeAddress,
	} as TransferOrdTokensConfig;

  console.log({transferConfig})
	const mintResponse = await transferOrdTokens(transferConfig);
	if (!mintResponse) {
		// return an error without throwing
		return {
			success: false,
			error: "Failed to mint MNEE",
			rawtx: "",
		};
	}

	try {
		const { tx } = mintResponse;

		console.log("Signed transaction");

		const rawtx = tx.toHex();

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
