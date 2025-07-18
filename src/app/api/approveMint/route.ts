import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey } from "@bsv/sdk";
import { APPROVER_PUBKEY, getMintWif, MNEE_API, MNEE_WEBHOOK_API } from "@/env";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import type { Prisma } from "@prisma/client";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
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
				try {
					const { rawtx, error, success } = await mintMnee(
						mintRequest.amount,
						mintRequest.address,
						request,
					);

					if (error) {
						throw new Error(error);
					}
					if (success) {
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
						await tx.mintRequest.update({
							where: { id: mintRequestId },
							data: {
								updatedAt: new Date(),
								txid: rawtx,
							},
						});
						return { status: "DONE", approvalsCount, minterTx: rawtx, approval };
					}
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
const mintMnee = async (
	amount: bigint,
	address: string,
	request: Request,
): Promise<{ success: boolean; rawtx: string; error?: string }> => {
	console.log("Starting mintMnee:", { amount: amount.toString(), address });
	// Fetching remote config
	const mintPk = PrivateKey.fromWif(await getMintWif());
	const approverPk = PublicKey.fromString(APPROVER_PUBKEY);
	const config = await prisma.config.findFirst();
	if (!config) {
		throw new Error("Config not found");
	}
	const latestMinterTx = config?.latestMinterTx;
	// QA-: "0100000002ebb1d72cac15f83534e3d067a84fc86fc6e2db0fb30029150106b0c098846b7e010000006b48304502210093da3a3054dda9c062e8c1d853f3f216c50c475d8f3fc5ccf7d49a7ddedea39302207d9747b830030fd4c9ffcb1fceb71333312b2bdfa16682c1ce83e1982baecd92c12102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ffffffff4c6e48d1ca0a3799add2c494ed5e7627d6e3dbd4245c4829ee7252fbfb14f47d010000006b483045022100c144758f75e311382ea7829b9034c0e7202bd0785fdca07091f8c42b49d5add802206f1184abf309e3970d30650294283b01d95feb6900cda4fd678849bae9ac5d52c12102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ffffffff030100000000000000d90063036f726451126170706c69636174696f6e2f6273762d3230004c7f7b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a223232313231323231323030303030222c226964223a22363463656131346162303136393735643039323036306663633134663061363138366138636566306463633664366165346133653836363831323839616531345f30227d6876a914a2455cf1b8bc508a7d3d7c469fb4c4feb800eef288ad2102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ac0100000000000000bc0063036f726451126170706c69636174696f6e2f6273762d3230004c857b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a223138343436373231313936313139323030303030222c226964223a22363463656131346162303136393735643039323036306663633134663061363138366138636566306463633664366165346133653836363831323839616531345f30227d6876a9147332d7a5bb41ca58892be9ab9de6d8d05489930a88ac6ffc0200000000001976a9147332d7a5bb41ca58892be9ab9de6d8d05489930a88ac00000000"
	const tx = await parseTransaction(latestMinterTx);
	let inscriptions = tx?.inscriptions?.[1];
	if (!inscriptions) {
		inscriptions = tx?.inscriptions?.[0];
	}
	if (!inscriptions) {
		return {
			rawtx: "",
			success: false,
			error: "Inscriptions not found"
		};
	}
	console.log("inscriptions", inscriptions);
	let currentSupply = BigInt(0);
	if (inscriptions?.metadata) {
		currentSupply = BigInt(inscriptions?.metadata?.currentSupply)
	} else {
		//Handle for QR and Prodution
		const databaseMint = await prisma.mintRequest.aggregate({
			where: {
				status: "DONE"
			},
			_sum: {
				amount: true
			}
		});
		currentSupply = databaseMint._sum.amount || BigInt(0);
	}
	const currectTotalSupply = BigInt(inscriptions?.amt);
	let latestDeployTokenTxOp = 1
	const totalSupply = currentSupply + BigInt(amount)
	const currectAvailableSupply = currectTotalSupply - BigInt(amount);
	const response = await createMintOp(
		amount,
		latestMinterTx,
		latestDeployTokenTxOp,
		address,
		config.tokenId,
		mintPk,
		approverPk,
		totalSupply,
		currectAvailableSupply,
		config.mintAddress
	);
	const isLocal = process.env.NEXT_PUBLIC_ENV === "local";
	const webhookUrl = isLocal
		? `${MNEE_WEBHOOK_API}/api/webhook`
		: `https://${request.headers.get('host')}/api/webhook`;

	const payload = {
		rawtx: Buffer.from(response.txHex, 'hex').toString('base64'),
		callback_url: webhookUrl,
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
		if (data?.error) {
			return {
				rawtx: "",
				success: false,
				error: data?.error
			};
		}
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