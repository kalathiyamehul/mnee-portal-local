import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey } from "@bsv/sdk";
import { getBurnWif, getMintWif, MNEE_API, MNEE_WEBHOOK_API } from "@/env";
import { fetchConfig, fetchRawTx, fetchTransaction } from "@/utils/api";
import { isSystemPaused } from "@/lib/systemStatus";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { createRedeemTx } from "@/new-cosiner/src/services/redeem";
import { parseTransaction } from "@/new-cosiner/src/services/helper";

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
        action: ActivityAction.BURN_REQUEST_APPROVE,
        metadata: {
          burnRequestId,
          burnRequest: JSON.stringify(burnRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      const updatedBurnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: { approvals: true },
      });

      if (updatedBurnRequest?.approvals.length === updatedBurnRequest?.no_of_approvals) {
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
        try {
          const { rawtx, error, success } = await burnMnee(
            burnRequest.amount,
            txid,
            request
          );
          if (error) {
            throw new Error(error);
          }
          if (success) {
            await tx.burnRequest.update({
              where: { id: burnRequestId },
              data: {
                updatedAt: new Date(),
                txid: rawtx,
              },
            });
          }
          return { status: "DONE", approval };
        } catch (error) {
          console.error("Error during minting:", error);
          const errorMessage =
            error instanceof Error
              ? error.message.replace(/^Error:\s*/, "")
              : "Transaction submission failed";
          throw new Error(errorMessage);
        }
      }
      return { status: "PENDING" };
    });

    return NextResponse.json({
      success: true,
      message: result.status === "APPROVED" ? "Burn request approved" : "Approval recorded",
      status: result.status,
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

// Helper function to mint MNEE tokens
const burnMnee = async (
  amount: bigint,
  txid: string,
  request: Request,
): Promise<{ success: boolean; rawtx: string; error?: string }> => {
  console.log("Starting burnMnee:", { amount: amount.toString(), txid });
  // Fetching remote config
  const BURN_WIF = await getBurnWif();
  const burnPk = PrivateKey.fromWif(BURN_WIF);
  const config = await prisma.config.findFirst();
  if (!config) {
    throw new Error("Config not found");
  }
  const redeemUtxoTx = await fetchRawTx(txid);
  const tx = await parseTransaction(config.latestMinterTx);
  const inscriptions = tx?.inscriptions?.[1];
  const currentSupply = BigInt(inscriptions?.metadata?.currentSupply)
  const currectTotalSupply = BigInt(inscriptions?.amt);


  const currectAvailableSupply = currectTotalSupply + BigInt(amount);
  console.log("Previous currectTotalSupply", currectTotalSupply)
  console.log("currectTotalSupply + amount", currectAvailableSupply)

  const totalSupply = currentSupply - BigInt(amount)
  console.log("Previous currentSupply", currentSupply)
  console.log("totalSupply - amount", totalSupply)

  const MINT_WIF = await getMintWif();
  const response = await createRedeemTx(
    config.latestMinterTx,
    1,
    redeemUtxoTx,
    0,
    config.tokenId,
    burnPk,
    currectAvailableSupply,
    totalSupply,
    config.mintAddress,
    MINT_WIF
  );
  console.log("response", response)
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
    const res = await fetch(`${MNEE_API}/v1/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("Burn Response:", data);
    if (data?.error) {
      return {
        rawtx: "",
        success: false,
        error: data?.error
      };
    }
    return {
      rawtx: data,
      success: false
    };
  } catch (error) {
    return {
      rawtx: "",
      success: false,
      error: error?.toString()
    };
  }
};


// const pk = PrivateKey.fromWif(await getBurnWif());
// const burnTx = new Transaction();

// burnTx.addInput({
//   sourceTXID: txid,
//   sourceOutputIndex: vout,
//   sourceTransaction,
//   unlockingScriptTemplate: new CosignTemplate().userUnlock(pk, "all", true),
// });

// const burnInscriptionData = {
//   p: "bsv-20",
//   op: "burn",
//   id: remoteConfig.tokenId,
//   amt: burnRequest.amount.toString(),
// };

// const burnDataB64 = Buffer.from(JSON.stringify(burnInscriptionData)).toString("base64");
// burnTx.addOutput({
//   lockingScript: applyInscription(
//     new CosignTemplate().lock(
//       remoteConfig.burnAddress,
//       PublicKey.fromString(remoteConfig.approver),
//     ),
//     {
//       dataB64: burnDataB64,
//       contentType: "application/bsv-20",
//     } as Inscription,
//   ),
//   satoshis: 1,
// });

// await burnTx.sign();

// const cosignResponse = await fetch(`${MNEE_API}/v1/transfer`, {
//   method: "POST",
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify({
//     rawtx: Buffer.from(burnTx.toHex(), "hex").toString("base64"),
//   }),
// });

// if (!cosignResponse.ok) {
//   const errorText = await cosignResponse.text();
//   try {
//     const errorJson = JSON.parse(errorText);
//     if (errorJson.message) {
//       if (errorJson.message.includes("OP_EQUALVERIFY failed")) {
//         throw new Error("Transaction verification failed. Please try again.");
//       }
//       throw new Error(errorJson.message);
//     }
//   } catch {
//     throw new Error("Failed to cosign burn transaction. Please try again.");
//   }
// }

// const cosignResponseJson = (await cosignResponse.json()) as { rawtx: string };
// const cosignTx = Transaction.fromBinary(toArray(cosignResponseJson.rawtx, 'base64'));
// if (!cosignTx) {
//   throw new Error("Failed to parse cosigned transaction");
// }