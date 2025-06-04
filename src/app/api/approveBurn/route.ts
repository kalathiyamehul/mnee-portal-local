import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, PublicKey, Transaction } from "@bsv/sdk";
import { getBurnWif, MNEE_API } from "@/env";
import { fetchConfig, fetchTransaction } from "@/utils/api";
import { applyInscription } from "js-1sat-ord";
import type { Inscription } from "js-1sat-ord";
import CosignTemplate from "@/templates/cosign";
import { Utils } from "@bsv/sdk";
import { isSystemPaused } from "@/lib/systemStatus";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitburnUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
const { toArray } = Utils;

export const POST = withCSRF(async function(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { burnRequestId } = await request.json();

    let newAppeovalID: string;
    const result = await prisma.$transaction(async (tx) => {
      const burnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: {
          approvals: true,
          requester: true,
        },
      });

      if (!burnRequest) {
        throw new Error("Burn request not found");
      }

      if (burnRequest.status !== "PENDING") {
        throw new Error("Burn request is not pending");
      }

      // Check if system is paused
      const isPaused = await isSystemPaused(tx);
      if (isPaused) {
        throw new Error("System is paused. Cannot approve burn requests at this time.");
      }

      const hasApproved = burnRequest.approvals.some(
        (approval) => approval.approvedBy === session.user.id
      );

      if (hasApproved) {
        throw new Error("You have already approved this request");
      }

      if (burnRequest.requestedBy === session.user.id) {
        throw new Error("You cannot approve your own request");
      }

      const approval = await tx.burnApproval.create({
        data: {
          burnRequestId,
          approvedBy: session.user.id,
        },
      });

      newAppeovalID = approval.id;

      await logActivity(tx, {
        name: "Burn Request Approved",
        action: "BURN_REQUEST_APPROVE",
        description: `Burn request ${burnRequestId} approved by user ${session.user.email}`,
        metadata: {
          burnRequest: JSON.stringify(burnRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      const updatedBurnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: { approvals: true },
      });

      if (updatedBurnRequest?.approvals.length === 2) {
        // Fetching remote config
        const remoteConfig = await fetchConfig();

        if (!remoteConfig) {
          throw new Error("Remote Token configuration not found");
        }

        if (!burnRequest.outpoint) {
          throw new Error("Burn request outpoint not found");
        }

        const [txid, voutStr] = burnRequest.outpoint.split('_');
        const vout = Number.parseInt(voutStr, 10);

        if (!txid || Number.isNaN(vout)) {
          throw new Error("Invalid burn request outpoint");
        }

        const sourceTransaction = await fetchTransaction(txid);
        if (!sourceTransaction) {
          throw new Error("Failed to fetch source transaction");
        }

        const pk = PrivateKey.fromWif(await getBurnWif());
        const burnTx = new Transaction();

        burnTx.addInput({
          sourceTXID: txid,
          sourceOutputIndex: vout,
          sourceTransaction,
          unlockingScriptTemplate: new CosignTemplate().userUnlock(pk, "all", true),
        });

        const burnInscriptionData = {
          p: "bsv-20",
          op: "burn",
          id: remoteConfig.tokenId,
          amt: burnRequest.amount.toString(),
        };
        
        const burnDataB64 = Buffer.from(JSON.stringify(burnInscriptionData)).toString("base64");
        burnTx.addOutput({
          lockingScript: applyInscription(
            new CosignTemplate().lock(
              remoteConfig.burnAddress,
              PublicKey.fromString(remoteConfig.approver),
            ),
            {
              dataB64: burnDataB64,
              contentType: "application/bsv-20",
            } as Inscription,
          ),
          satoshis: 1,
        });

        await burnTx.sign();

        const cosignResponse = await fetch(`${MNEE_API}/v1/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawtx: Buffer.from(burnTx.toHex(), "hex").toString("base64"),
          }),
        });

        if (!cosignResponse.ok) {
          const errorText = await cosignResponse.text();
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
              if (errorJson.message.includes("OP_EQUALVERIFY failed")) {
                throw new Error("Transaction verification failed. Please try again.");
              }
              throw new Error(errorJson.message);
            }
          } catch {
            throw new Error("Failed to cosign burn transaction. Please try again.");
          }
        }

        const cosignResponseJson = (await cosignResponse.json()) as { rawtx: string };
        const cosignTx = Transaction.fromBinary(toArray(cosignResponseJson.rawtx, 'base64'));
        if (!cosignTx) {
          throw new Error("Failed to parse cosigned transaction");
        }

        await tx.burnRequest.update({
          where: { id: burnRequestId },
          data: {
            status: "APPROVED",
            updatedAt: new Date(),
            txid: cosignTx.id('hex'),
          },
        });

        await logActivity(tx, {
          name: "Burn Request Fully Approved",
          action: "BURN_REQUEST_FULLY_APPROVED",
          description: `Burn request ${burnRequestId} fully approved and transaction created`,
          metadata: {
            burnRequestId: burnRequestId,
            txid: cosignTx.id('hex'),
            burnTx: cosignTx.toHex(),
          },
        });

        return { status: "APPROVED", burnTx: cosignTx.toHex() };
      }

      return { status: "PENDING" };
    });

    // emit Burn Approve event
		const approvalWithUser = await prisma.burnApproval.findUnique({
			where: {
				id: newAppeovalID!,
			},
			include: {
				approver: true,
			},
		});
		emitburnUpdate({
			activityId: burnRequestId,
			approval: approvalWithUser,
			type: "APPROVE",
		});

    return NextResponse.json({
      success: true,
      message: result.status === "APPROVED" ? "Burn request approved" : "Approval recorded",
      status: result.status,
      burnTx: result.burnTx,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    }, { 
      status: 400
    });
  }
}, createAPIRateLimit())