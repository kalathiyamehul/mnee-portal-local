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
import { recordTransaction, TransactionType } from "@/lib/recordTransactions";
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

	let mintRequestId: string = "";
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

			// Check if the customer is active
			if (!mintRequest.customerId) {
				throw new Error("Mint request does not have a valid customerId");
			}
			const customer = (await tx.customer.findUnique({
				where: { id: mintRequest.customerId }
			}));
			if (!customer) {
				throw new Error("Customer not found");
			}
			if (!customer.isActive) {
				throw new Error("Customer is inactive");
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
			console.log("approvalsCount", approvalsCount);
			if (approvalsCount === mintRequest.no_of_approvals) {
				// Update request status to APPROVED
				try {
					console.log("Starting minting process for request:", mintRequestId);
					const { rawtx, error, success } = await mintMnee(
						mintRequest.amount,
						mintRequest.address,
						request,
					);

					console.log("Mint result:", { success, error, rawtxLength: rawtx?.length });

					if (error) {
						console.error("Mint operation failed with error:", error);
						throw new Error(`Mint operation failed: ${error}`);
					}

					if (!success) {
						console.error("Mint operation was not successful");
						throw new Error("Mint operation was not successful");
					}

					if (!rawtx) {
						console.error("No transaction returned from mint operation");
						throw new Error("No transaction returned from mint operation");
					}
					console.log("Updating mint request status to APPROVED");
					await tx.mintRequest.update({
						where: { id: mintRequestId },
						data: {
							status: "APPROVED",
							updatedAt: new Date(),
							ticket_id: rawtx,
						},
					});

					const updatedMintRequest = await tx.mintRequest.findUnique({
						where: { id: mintRequestId },
						include: {
							approvals: {
								include: {
									approver: {
										select: {
											id: true,
											email: true,
											name: true,
										},
									},
								},
							},
							requester: {
								select: {
									id: true,
									email: true,
									name: true,
								},
							},
						},
					});

					await logActivity(tx, {
						action: ActivityAction.MINT_REQUEST_FULLY_APPROVED,
						metadata: {
							mintRequestId,
							approvalsCount,
						},
					});

					console.log("Recording transaction for mint request:", mintRequestId);
					const allApprovers = updatedMintRequest?.approvals.map((approval) => ({
						id: approval.approver.id,
						email: approval.approver.email,
						name: approval.approver.name
					}))

		            console.log("All approvers:", allApprovers);


					await recordTransaction(tx, {
						requestId: mintRequestId || '',
						txid: rawtx,
						requestedBy: mintRequest.requestedBy,
						timestamp: new Date(),
						type: TransactionType.MINT,
						approvers: [...(allApprovers || [])],
					})

					emitMintUpdate({
						activityId: requestId,
						approval: "Mint Request Fully Approved",
						type: "APPROVED",
					});
					return { status: "DONE", approvalsCount, minterTx: rawtx, approval };
				} catch (error) {
					const mintError = error instanceof Error ? error.message : String(error || 'Unknown minting error');
					console.error("Error during minting process:", {
						mintRequestId: mintRequestId || 'unknown',
						error: mintError,
						errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
						errorType: typeof error,
						errorName: error instanceof Error ? error.name : 'Unknown'
					});

					// Clean up the error message for user display
					const cleanErrorMessage = mintError.replace(/^Error:\s*/, "").replace(/^Mint operation failed:\s*/, "");
					throw new Error(cleanErrorMessage);
				}
			}

			console.log("Not enough approvals yet, staying in PENDING state");
			return { status: "PENDING", approvalsCount, approval };
		}, { timeout: 600000 });
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
			message: "Request approved",
		});
	} catch (error) {
		// Ensure we have a proper error message to log
		const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error occurred');
		// Safely log error information without null values
		console.error("Error processing approval:", {
			mintRequestId: mintRequestId || 'unknown',
			error: errorMessage,
			errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
			errorType: typeof error,
			errorName: error instanceof Error ? error.name : 'Unknown'
		});

		return NextResponse.json(
			{
				success: false,
				error: errorMessage,
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
	console.log("Initializing mint operation with private keys and config");

	let mintPk: PrivateKey;
	let approverPk: PublicKey;
	let config: any;
	let latestMinterTx: string;
	let tx: any;
	let inscriptions: any;
	let migration: any

	try {
		mintPk = PrivateKey.fromWif(await getMintWif());
		approverPk = PublicKey.fromString(APPROVER_PUBKEY);
		config = await prisma.config.findFirst();
		if (!config) {
			console.error("Config not found in database");
			return {
				rawtx: "",
				success: false,
				error: "System configuration not found"
			};
		}

		latestMinterTx = config?.latestMinterTx;
		if (!latestMinterTx) {
			console.error("Latest minter transaction not found in config");
			return {
				rawtx: "",
				success: false,
				error: "Latest minter transaction not found"
			};
		}

		console.log("Parsing latest minter transaction");
		// QA-: "0100000002ebb1d72cac15f83534e3d067a84fc86fc6e2db0fb30029150106b0c098846b7e010000006b48304502210093da3a3054dda9c062e8c1d853f3f216c50c475d8f3fc5ccf7d49a7ddedea39302207d9747b830030fd4c9ffcb1fceb71333312b2bdfa16682c1ce83e1982baecd92c12102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ffffffff4c6e48d1ca0a3799add2c494ed5e7627d6e3dbd4245c4829ee7252fbfb14f47d010000006b483045022100c144758f75e311382ea7829b9034c0e7202bd0785fdca07091f8c42b49d5add802206f1184abf309e3970d30650294283b01d95feb6900cda4fd678849bae9ac5d52c12102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ffffffff030100000000000000d90063036f726451126170706c69636174696f6e2f6273762d3230004c7f7b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a223232313231323231323030303030222c226964223a22363463656131346162303136393735643039323036306663633134663061363138366138636566306463633664366165346133653836363831323839616531345f30227d6876a914a2455cf1b8bc508a7d3d7c469fb4c4feb800eef288ad2102b92c2dbded4e81747d4d58ab41923f1ec014ac2c3b37db61e414028b5bda8533ac0100000000000000bc0063036f726451126170706c69636174696f6e2f6273762d3230004c857b2270223a226273762d3230222c226f70223a227472616e73666572222c22616d74223a223138343436373231313936313139323030303030222c226964223a22363463656131346162303136393735643039323036306663633134663061363138366138636566306463633664366165346133653836363831323839616531345f30227d6876a9147332d7a5bb41ca58892be9ab9de6d8d05489930a88ac6ffc0200000000001976a9147332d7a5bb41ca58892be9ab9de6d8d05489930a88ac00000000"
		tx = await parseTransaction(latestMinterTx);
		if (!tx) {
			console.error("Failed to parse latest minter transaction");
			return {
				rawtx: "",
				success: false,
				error: "Failed to parse latest minter transaction"
			};
		}

		inscriptions = tx?.inscriptions?.[1];
		if (!inscriptions) {
			inscriptions = tx?.inscriptions?.[0];
		}
		if (!inscriptions) {
			console.error("No inscriptions found in transaction");
			return {
				rawtx: "",
				success: false,
				error: "Token inscriptions not found in transaction"
			};
		}
	} catch (error) {
		const initError = error instanceof Error ? error.message : String(error || 'Unknown initialization error');
		console.error("Error during mint initialization:", {
			error: initError,
			errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
			errorType: typeof error,
			errorName: error instanceof Error ? error.name : 'Unknown'
		});
		return {
			rawtx: "",
			success: false,
			error: `Initialization failed: ${initError}`
		};
	}
	console.log("Calculating supply and creating mint operation");
	let response: any;

	try {
		let currentSupply = BigInt(0);
		let latestDeployTokenTxOp = tx?.outputIndex;
		if (inscriptions?.metadata) {
			currentSupply = BigInt(inscriptions?.metadata?.currentSupply)
		} else {
			//Handle for QR and Production 
			console.log("Fetching current supply from database");
			const databaseMint = await prisma.mintRequest.aggregate({
				where: {
					status: "DONE"
				},
				_sum: {
					amount: true
				}
			});
			currentSupply = databaseMint._sum.amount || BigInt(0);
			migration = true;
			latestDeployTokenTxOp = latestDeployTokenTxOp - 1;
		}

		if (!inscriptions?.amt) {
			console.error("Token amount not found in inscriptions");
			return {
				rawtx: "",
				success: false,
				error: "Token amount not found in inscriptions"
			};
		}

		const currectTotalSupply = BigInt(inscriptions.amt);
		const totalSupply = currentSupply + BigInt(amount);
		const currectAvailableSupply = currectTotalSupply - BigInt(amount);

		console.log("Supply calculation:", {
			currentSupply: currentSupply.toString(),
			currectTotalSupply: currectTotalSupply.toString(),
			mintAmount: amount.toString(),
			totalSupply: totalSupply.toString(),
			currectAvailableSupply: currectAvailableSupply.toString()
		});

		if (currectAvailableSupply < 0n) {
			console.error("Insufficient available supply for minting");
			return {
				rawtx: "",
				success: false,
				error: "Insufficient available supply for minting"
			};
		}

		console.log("Creating mint operation");
		response = await createMintOp(
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

		if (!response || !response.txHex) {
			console.error("Invalid response from createMintOp");
			return {
				rawtx: "",
				success: false,
				error: "Failed to create mint transaction"
			};
		}

		console.log("Mint operation created successfully, transaction hex length:", response.txHex.length);
	} catch (error) {
		const supplyError = error instanceof Error ? error.message : String(error || 'Unknown supply calculation error');
		console.error("Error during supply calculation or mint operation creation:", {
			error: supplyError,
			errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
			errorType: typeof error,
			errorName: error instanceof Error ? error.name : 'Unknown'
		});
		return {
			rawtx: "",
			success: false,
			error: `Supply calculation failed: ${supplyError}`
		};
	}
	const isLocal = process.env.NEXT_PUBLIC_ENV === "local";
	const webhookUrl = isLocal
		? `${MNEE_WEBHOOK_API}/api/webhook`
		: `https://${request.headers.get('host')}/api/webhook`;

	const payload = {
		rawtx: Buffer.from(response.txHex, 'hex').toString('base64'),
		callback_url: webhookUrl,
		...(migration && { migration: true })
	}
	console.log(payload)
	try {
		console.log("Sending mint request to MNEE API:", `${MNEE_API}/v1/mint`);
		const res = await fetch(`${MNEE_API}/v1/mint`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(payload),
		});

		console.log("MNEE API Response status:", res.status, res.statusText);

		if (!res.ok) {
			const errorText = await res.text();
			console.error("MNEE API returned error status:", {
				status: res.status,
				statusText: res.statusText,
				errorText
			});
			return {
				rawtx: "",
				success: false,
				error: `MNEE API error (${res.status}): ${errorText || res.statusText}`
			};
		}

		const dataText = await res.text();
		console.log("Mint Response:", dataText);

		let dataJson: any;
		try {
			dataJson = JSON.parse(dataText);
		} catch {
			dataJson = null;
		}

		if (dataJson && dataJson.error) {
			console.error("MNEE API returned error in response:", dataJson.error);
			return {
				rawtx: "",
				success: false,
				error: dataJson.error
			};
		}

		if (!dataText) {
			console.error("MNEE API returned empty response");
			return {
				rawtx: "",
				success: false,
				error: "Empty response from MNEE API"
			};
		}

		console.log("Mint operation successful, transaction ID:", dataText);
		return {
			rawtx: dataText,
			success: true
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown fetch error');
		console.error("Error calling MNEE API:", {
			error: errorMessage,
			errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
			errorType: typeof error,
			errorName: error instanceof Error ? error.name : 'Unknown'
		});
		return {
			rawtx: "",
			success: false,
			error: `Network error: ${errorMessage}`
		};
	}
};