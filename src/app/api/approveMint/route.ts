import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { P2PKH, PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import CosignTemplate from "@/templates/cosign";
import { getConfig } from "@/lib/config";
import { fetchConfig, fetchTransaction } from "@/utils/api";
import type { MintRequest } from "@/types/utxo";
import { MINT_WIF, MNEE_API, MNEE_ORDINALS_SERVICE } from "@/env";
import { signMint } from "@/templates/vault";
import { getFundingUtxos } from "@/utils/utxo";
import { isSystemPaused } from "@/lib/systemStatus";

export async function POST(request: Request) {
	console.log('Starting approveMint request');
	const session = await getServerSession(authOptions);
	console.log('Session:', { userId: session?.user?.id });

	if (!session?.user?.id) {
		console.log('Unauthorized: No session or user ID');
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let mintRequestId: string | undefined;

	try {
		const { mintRequestId: requestId } = await request.json();
		mintRequestId = requestId;
		console.log('Processing mint request:', { mintRequestId });

		const result = await prisma.$transaction(async (tx) => {
			// Verify the approving user exists
			console.log('Verifying approving user:', { userId: session.user.id });
			const approvingUser = await tx.user.findUnique({
				where: { id: session.user.id },
			});

			if (!approvingUser) {
				console.log('Approving user not found');
				throw new Error("Approving user not found");
			}

			// Fetch the mint request
			console.log('Fetching mint request');
			const mintRequest = await tx.mintRequest.findUnique({
				where: { id: mintRequestId },
				include: {
					requester: true,
					approvals: true,
				},
			});
			console.log('Found mint request:', { 
				requestId: mintRequest?.id,
				status: mintRequest?.status,
				requesterId: mintRequest?.requestedBy,
				approvalCount: mintRequest?.approvals.length 
			});

			if (!mintRequest) {
				console.log('Mint request not found');
				throw new Error("Mint request not found");
			}

			if (mintRequest.status !== "PENDING") {
				console.log('Invalid status:', { status: mintRequest.status });
				throw new Error("Request is not pending");
			}

			// Check if system is paused
			console.log('Checking system pause status');
			const isPaused = await isSystemPaused(tx);
			if (isPaused) {
				console.log('System is paused');
				throw new Error("System is paused. Cannot approve mint requests at this time.");
			}

			// Prevent self-approval
			console.log('Checking for self-approval:', {
				requesterId: mintRequest.requestedBy,
				approverId: session.user.id
			});
			if (mintRequest.requestedBy === session.user.id) {
				console.log('Self-approval attempt detected');
				throw new Error("Cannot approve your own request");
			}

			// Check if the user has already approved
			console.log('Checking for existing approval');
			const existingApproval = await tx.actionApproval.findFirst({
				where: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			if (existingApproval) {
				console.log('User has already approved');
				throw new Error("You have already approved this request");
			}

			// Check if the target address is blacklisted
			console.log('Checking blacklist status for address:', mintRequest.address);
			const blacklistRequest = await tx.blacklistRequest.findFirst({
				where: {
					address: mintRequest.address,
					status: 'APPROVED',
					action: 'BLACKLIST',
				},
				orderBy: {
					createdAt: 'desc',
				},
			});

			if (blacklistRequest) {
				console.log('Address is blacklisted');
				throw new Error("Cannot approve mint: the target address is blacklisted");
			}

			// Check if the target address is frozen
			console.log('Checking freeze status for address:', mintRequest.address);
			const freezeRequest = await tx.freezeRequest.findFirst({
				where: {
					address: mintRequest.address,
					status: 'APPROVED',
				},
				orderBy: {
					createdAt: 'desc',
				},
			});

			if (freezeRequest?.action === 'FREEZE') {
				console.log('Address is frozen');
				throw new Error("Cannot approve mint: the target address is frozen");
			}

			// Create approval
			console.log('Creating approval');
			await tx.actionApproval.create({
				data: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			// Check if we have enough approvals
			console.log('Checking approval count');
			const approvalsCount = await tx.actionApproval.count({
				where: { mintRequestId },
			});
			console.log('Current approval count:', approvalsCount);

			if (approvalsCount === 2) {
				console.log('Required approvals reached, updating status to APPROVED');
				// Update request status to APPROVED
				await tx.mintRequest.update({
					where: { id: mintRequestId },
					data: { status: "APPROVED" },
				});

				try {
					console.log('Starting MNEE mint process');
					const { rawtx } = await mintMnee(mintRequest.amount, mintRequest.address);
					console.log('MNEE mint successful, updating request status');

					// update the request status and txid
					await tx.mintRequest.update({
						where: { id: mintRequestId },
						data: { 
							status: "DONE", 
							updatedAt: new Date(),
							txid: Transaction.fromHex(rawtx).id('hex'),
						},
					});

					return { status: "DONE", approvalsCount, minterTx: rawtx };
				} catch (error) {
					// If minting fails, propagate the error
					console.error("Error during minting:", error);
					const errorMessage = error instanceof Error 
						? error.message.replace(/^Error:\s*/, '') // Remove "Error: " prefix
						: "Transaction submission failed";
					
					throw new Error(errorMessage);
				}
			}

			console.log('Not enough approvals yet, staying in PENDING state');
			return { status: "PENDING", approvalsCount };
		});

		console.log('Transaction completed successfully:', result);
		return NextResponse.json({
			success: true,
			message: result.status === "APPROVED" ? "Request approved" : "Approval recorded",
			status: result.status,
			approvalsCount: result.approvalsCount,
			minterTx: result.minterTx,
		});
	} catch (error) {
		console.error("Error processing approval:", error);

		// If we have a mintRequestId, update the request status to failed
		if (mintRequestId) {
			try {
				console.log('Updating request status to FAILED');
				await prisma.mintRequest.update({
					where: { id: mintRequestId },
					data: { 
						status: "FAILED",
						updatedAt: new Date(),
					},
				});
			} catch (updateError) {
				console.error("Failed to update mint request status:", updateError);
			}
		}

		return NextResponse.json({ 
			success: false,
			error: error instanceof Error ? error.message : "Failed to process approval",
			requestId: mintRequestId || null
		}, { status: 500 });
	}
}

// Helper function to mint MNEE tokens
const mintMnee = async (amount: bigint, address: string) => {
	console.log('Starting mintMnee:', { amount: amount.toString(), address });
	const config = await fetchConfig();
	console.log('Fetched config:', { approver: config.approver });

	// create the cosign template
	const template = new CosignTemplate().lock(
		address,
		PublicKey.fromString(config.approver),
	);

	const token_ls = template.toHex();
	console.log('Created token template');

	// look up latest_minter_tx
	const dbConfig = await getConfig();
	const latest_minter_tx = dbConfig?.latestMinterTx;
	console.log('Got latest minter tx');

	if (!latest_minter_tx) {
		console.log('No latest minter tx found');
		throw new Error("Latest minter tx not found");
	}

	// MNEE contract config
	const pk = PrivateKey.fromWif(MINT_WIF);
	const fundingAddress = pk.toAddress();
	const funding_utxos = await getFundingUtxos(fundingAddress);
	console.log('Got funding UTXOs:', { count: funding_utxos.length });
	console.log('Funding UTXOs:', funding_utxos);

	if (!funding_utxos.length) {
		throw new Error("No funding UTXOs available");
	}

	const fee_per_kb = 10;
	const change_addr = fundingAddress;
	console.log('Change address:', change_addr);

	console.log('Building mint request with:', {
		amount: Number(amount),
		token_ls_length: token_ls.length,
		latest_minter_tx_length: latest_minter_tx?.length,
		funding_utxos_length: funding_utxos.length,
		fee_per_kb,
		change_addr
	});

	const mintRequest = {
		amount: Number(amount),
		token_ls,
		latest_minter_tx,
		funding_utxos: funding_utxos.map(utxo => ({
			txid: utxo.txid,
			vout: utxo.vout,
			locking_script: utxo.locking_script,
			satoshis: Number(utxo.satoshis)
		})),
		fee_per_kb,
		change_addr: fundingAddress
	};

	// mint the MNEE
	const requestBody = JSON.stringify(mintRequest);
	console.log('Mint request payload:', requestBody);

	const mintResponse = await fetch(`${MNEE_ORDINALS_SERVICE}/mint`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: requestBody,
	});

	if (!mintResponse.ok) {
		const errorText = await mintResponse.text();
		console.error('Mint service error:', {
			status: mintResponse.status,
			statusText: mintResponse.statusText,
			body: errorText
		});
		throw new Error(`Failed to mint MNEE: ${errorText || 'No response from service'}`);
	}

	const responseText = await mintResponse.text();
	console.log('Raw mint response:', responseText);

	if (!responseText) {
		console.error('Empty response from mint service');
		throw new Error('Empty response from mint service');
	}

	try {
		const { minter_tx } = JSON.parse(responseText);
		if (!minter_tx) {
			throw new Error('No minter_tx in response');
		}

		const tx = Transaction.fromHex(minter_tx);
		console.log('Created transaction from hex');

		// iterate over the inputs and set script template to p2pkh
		for (const input of tx.inputs) {
			if (!input.unlockingScript?.chunks.length) {
				input.sourceTransaction = await fetchTransaction(input.sourceTXID || '');
				input.unlockingScriptTemplate = new P2PKH().unlock(pk);
			}
		}

		// set the source transaction to the latest minter tx
		tx.inputs[0].sourceTransaction = Transaction.fromHex(latest_minter_tx);
		signMint(tx, 0, pk);
		await tx.sign();
		console.log('Signed transaction');

		const rawtx = tx.toHex();

		// broadcast & ingest
		console.log('Broadcasting transaction');
		const broadcastResponse = await fetch(`${MNEE_API}/v1/broadcast`, {
			method: "POST",
			headers: {"Content-Type": "application/json"},
			body: JSON.stringify({
				rawtx: Buffer.from(rawtx, "hex").toString("base64"),
			}),
		});

		if (!broadcastResponse.ok) {
			const broadcastError = await broadcastResponse.text();
			console.error('Broadcast failed:', broadcastError);
			
			// Check if it's a double-spend error
			try {
				const errorJson = JSON.parse(broadcastError);
				if (errorJson.message?.includes('double-spend')) {
					console.log('Transaction was already broadcast');
					// Don't throw - the transaction is already on chain
					return { rawtx };
				}
			} catch (e) {
				// If we can't parse the error, just continue with the normal error flow
			}
			
			throw new Error(`Failed to broadcast MNEE: ${broadcastError}`);
		}

		// save the new tx id to the db
		try {
			console.log('Updating config with latest minter tx');
			await prisma.config.update({
				where: { id: 1 },
				data: { latestMinterTx: rawtx },
			});
		} catch (configError) {
			console.error("Failed to update config with latest minter tx:", configError);
			// Don't throw here - the mint was successful, we just couldn't update the config
			// This will be handled in the next mint attempt
		}

		return { rawtx };
	} catch (error) {
		console.error("Error during mint process:", error);
		throw new Error(error instanceof Error ? error.message : "Unknown error");
	}
};
