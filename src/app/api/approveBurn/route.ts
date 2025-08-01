import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { PrivateKey, Transaction } from "@bsv/sdk";
import { getBurnWif, getMintWif, MNEE_API, MNEE_WEBHOOK_API } from "@/env";
import { fetchConfig, fetchRawTx, fetchTransaction } from "@/utils/api";
import { isSystemPaused } from "@/lib/systemStatus";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { createRedeemTx } from "@/new-cosiner/src/services/redeem";
import { parseTransaction } from "@/new-cosiner/src/services/helper";

export const POST = withCSRF(async function(request: Request) {
  console.log("Starting approveBurn request");
  const session = await getServerSession(authOptions);
  console.log("Session:", { userId: session?.user?.id });
  if (!session?.user?.id) {
    console.log("Unauthorized: No session or user ID");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let burnRequestId: string = "";
  try {
    const { burnRequestId: requestId } = await request.json();
    burnRequestId = requestId;
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
        try {
          console.log("Starting burning process for request:", burnRequestId);
          const { rawtx, error, success } = await burnMnee(
            burnRequest.amount,
            txid,
            request
          );

          console.log("Burn result:", { success, error, rawtxLength: rawtx?.length });

          if (error) {
            console.error("Burn operation failed with error:", error);
            throw new Error(`Burn operation failed: ${error}`);
          }

          if (!success) {
            console.error("Burn operation was not successful");
            throw new Error("Burn operation was not successful");
          }

          if (!rawtx) {
            console.error("No transaction returned from burn operation");
            throw new Error("No transaction returned from burn operation");
          }

          console.log("Updating burn request status to APPROVED");
          await tx.burnRequest.update({
            where: { id: burnRequestId },
            data: {
              status: "APPROVED",
              updatedAt: new Date(),
              ticket_id: rawtx,
            },
          });

          await logActivity(tx, {
            action: ActivityAction.BURN_REQUEST_APPROVE,
            metadata: {
              burnRequestId,
              burnRequest: JSON.stringify(burnRequest, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
              ),
            },
          });
          console.log("Burn process completed successfully");
          return { status: "DONE", approval };
        } catch (error) {
          const burnError = error instanceof Error ? error.message : String(error || 'Unknown burning error');
          console.error("Error during burning process:", {
            burnRequestId: burnRequestId || 'unknown',
            error: burnError,
            errorStack: error instanceof Error ? (error.stack || 'No stack trace') : 'Not an Error object',
            errorType: typeof error,
            errorName: error instanceof Error ? error.name : 'Unknown'
          });

          // Clean up the error message for user display
          const cleanErrorMessage = burnError.replace(/^Error:\s*/, "").replace(/^Burn operation failed:\s*/, "");
          throw new Error(cleanErrorMessage);
        }
      }
      console.log("Not enough approvals yet, staying in PENDING state");
      return { status: "PENDING", approval };
    }, { timeout: 600000 });

    console.log("Transaction completed successfully:", result);
    return NextResponse.json({
      success: true,
      message: result.status === "APPROVED" ? "Burn request approved" : "Approval recorded",
      status: result.status,
    });
  } catch (error) {
    // Ensure we have a proper error message to log
    const errorMessage = error instanceof Error ? error.message : String(error || 'Unknown error occurred');
    // Safely log error information without null values
    console.error("Error processing approval:", {
      burnRequestId: burnRequestId || 'unknown',
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
}, createAPIRateLimit())

// Helper function to burn MNEE tokens
const burnMnee = async (
  amount: bigint,
  txid: string,
  request: Request,
): Promise<{ success: boolean; rawtx: string; error?: string }> => {
  console.log("Starting burnMnee:", { amount: amount.toString(), txid });
  // Fetching remote config
  console.log("Initializing burn operation with private keys and config");

  let burnPk: PrivateKey;
  let config: any;
  let latestMinterTx: string;
  let tx: any;
  let inscriptions: any;
  let redeemUtxoTx: any;

  try {
    const BURN_WIF = await getBurnWif();
    burnPk = PrivateKey.fromWif(BURN_WIF);
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

    console.log("Fetching redeem UTXO transaction");
    redeemUtxoTx = await fetchRawTx(txid);
    if (!redeemUtxoTx) {
      console.error("Failed to fetch redeem UTXO transaction");
      return {
        rawtx: "",
        success: false,
        error: "Failed to fetch redeem UTXO transaction"
      };
    }

    console.log("Parsing latest minter transaction");
    tx = await parseTransaction(config.latestMinterTx);
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
    console.error("Error during burn initialization:", {
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

  console.log("Calculating supply and creating burn operation");
  let response: any;

  try {
    if (!inscriptions?.metadata?.currentSupply) {
      console.log("Perform Migration Operation to Burn Tokens");
      return {
        rawtx: "",
        success: false,
        error: "Perform Migration Opration to burn tokens"
      }
    }
    const currentSupply = BigInt(inscriptions?.metadata?.currentSupply || 0);
    if (currentSupply === 0n) {
      console.error("Current supply is missing, cannot burn");
      return {
        rawtx: "",
        success: false,
        error: "Current supply is missing, cannot burn"
      };
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
    const currectAvailableSupply = currectTotalSupply + BigInt(amount);
    const totalSupply = currentSupply - BigInt(amount);
    const latestDeployedTokenOpIndex = tx.outputIndex;
    const redeemUtxoIndex = 0;
    const MINT_WIF = await getMintWif();

    console.log("Supply calculation:", {
      currentSupply: currentSupply.toString(),
      currectTotalSupply: currectTotalSupply.toString(),
      burnAmount: amount.toString(),
      totalSupply: totalSupply.toString(),
      currectAvailableSupply: currectAvailableSupply.toString()
    });

    if (totalSupply < 0n) {
      console.error("Insufficient supply for burning");
      return {
        rawtx: "",
        success: false,
        error: "Insufficient supply for burning"
      };
    }

    console.log("Creating burn operation");
    response = await createRedeemTx(
      config.latestMinterTx,
      latestDeployedTokenOpIndex,
      redeemUtxoTx,
      redeemUtxoIndex,
      config.tokenId,
      burnPk,
      currectAvailableSupply,
      totalSupply,
      config.mintAddress,
      MINT_WIF
    );

    if (!response || !response.txHex) {
      console.error("Invalid response from createRedeemTx");
      return {
        rawtx: "",
        success: false,
        error: "Failed to create burn transaction"
      };
    }

    console.log("Burn operation created successfully, transaction hex length:", response.txHex.length);
  } catch (error) {
    const supplyError = error instanceof Error ? error.message : String(error || 'Unknown supply calculation error');
    console.error("Error during supply calculation or burn operation creation:", {
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
  }
  console.log(payload)
  try {
    console.log("Sending burn request to MNEE API:", `${MNEE_API}/v1/redeem`);
    const res = await fetch(`${MNEE_API}/v1/redeem`, {
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

    const data = await res.text();
    console.log("Burn Response:", data);

    let parsedData: any;
    try {
      parsedData = JSON.parse(data);
    } catch {
      parsedData = null;
    }

    if (parsedData && parsedData.error) {
      console.error("MNEE API returned error in response:", parsedData.error);
      return {
        rawtx: "",
        success: false,
        error: parsedData.error
      };
    }

    if (!data) {
      console.error("MNEE API returned empty response");
      return {
        rawtx: "",
        success: false,
        error: "Empty response from MNEE API"
      };
    }

    // If parsedData is an object and has a transaction id, use it; otherwise, use the raw string
    const txId = parsedData && parsedData.txid ? parsedData.txid : data;

    console.log("Burn operation successful, transaction ID:", txId);
    return {
      rawtx: txId,
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