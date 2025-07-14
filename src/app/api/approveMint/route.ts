import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import { APPROVER_PUBKEY, getMintWif, MNEE_API, MNEE_WEBHOOK_API } from "@/env";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import type { Prisma } from "@prisma/client";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { emitMintUpdate } from "@/lib/sseEmitter";
import { createMintOp } from "@/new-cosiner/src/services/mint";
import { parseTransaction } from "@/new-cosiner/src/services/helper";

type MintRequestWithRelations = Prisma.MintRequestGetPayload<{
	include: {
		requester: true;
		approvals: true;
	};
}>;

export const POST = async function (request: Request) {
	console.log("Starting approveMint request");
	const session = await getServerSession(authOptions);
	console.log("Session:", { userId: session?.user?.id });
	if (!session?.user?.id) {
		console.log("Unauthorized: No session or user ID");
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	let mintRequestId: string;
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
						Number(mintRequest.amount),
						mintRequest.address,
					);

					if (!success) {
						throw new Error(error);
					}

					await tx.mintRequest.update({
						where: { id: mintRequestId },
						data: {
							updatedAt: new Date(),
							txid: rawtx,
						},
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
			activityId: mintRequestId,
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
}

// Helper function to mint MNEE tokens
export const mintMnee = async (
	amount: number,
	address: string,
): Promise<{ success: boolean; rawtx: string; error?: string }> => {
	console.log("Starting mintMnee:", { amount: amount.toString(), address });
	// Fetching remote config
	const MINT_ADDRESS = await getMintWif();
	console.log("MINT_ADDRESS:", MINT_ADDRESS);
	const mintPk = PrivateKey.fromWif(MINT_ADDRESS);
	// const mintPk = PrivateKey.fromWif(MINT_WIF);
	const approverPk = PublicKey.fromString(APPROVER_PUBKEY);
	const config = await prisma.config.findFirst();
	if (!config) {
		throw new Error("Config not found");
	}
	const tx = await parseTransaction(config.latestMinterTx);
	const inscriptions = tx?.inscriptions?.[1];
	const currentSupply = Number(inscriptions?.metadata?.currentSupply)
	const currectTotalSupply = Number(inscriptions?.amt);
	let latestDeployTokenTxOp = 1
	const totalSupply = currentSupply + Number(amount)
	const currectAvailableSupply = currectTotalSupply - amount;
	const response = await createMintOp(
		Number(amount),
		config.latestMinterTx,
		latestDeployTokenTxOp,
		address,
		config.tokenId,
		mintPk,
		approverPk,
		totalSupply,
		currectAvailableSupply
	);
	const payload = {
		rawtx: Buffer.from(response.txHex, 'hex').toString('base64'),
		callback_url: `${MNEE_WEBHOOK_API}/api/webhook`,
	}
	console.log(payload)
	try {
		const res = await fetch(`${MNEE_API}/v1/mint`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		const data = await res.json();
		console.log("Mint Response:", data);
		return {
			rawtx: data,
			success: true
		};
	} catch (error) {
		return {
			rawtx: "",
			success: false,
			error: error?.toString()
		};
	}
};