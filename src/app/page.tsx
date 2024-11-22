// app/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Addresses, Balance, SignatureRequest, SignatureResponse, useYoursWallet } from "yours-wallet-provider";
import { useMutation } from "@tanstack/react-query";
import { P2PKH, Script, Transaction, UnlockingScript } from "@bsv/sdk";
import { toBitcoin, toToken, toTokenSat } from "satoshi-token";
// import P2PKHApprovedTemplate from "@/templates/p2pkhApproved";
import { applyInscription, Inscription } from "js-1sat-ord";
import { Utils } from "@bsv/sdk";
import toast from "react-hot-toast";
import { Config } from "../types";
import { fetchConfig, fetchMneeUtxos, fetchTransaction, MNEE_API } from "@/utils/api";
const { toArray, toBase64 } = Utils;

export default function Dashboard() {
  const wallet = useYoursWallet();
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [mneeBalance, setMneeBalance] = useState<number>(0);
  const [balance, setBalance] = useState<Balance | undefined>();
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [config, setConfig] = useState<Config | null>(null);

  const connectWallet = async () => {
    if (!wallet.isReady) {
      window.open("https://yours.org", "_blank");
      return;
    }
    const pubKey = await wallet.connect();
    if (pubKey) {
      const addresses = await wallet.getAddresses();
      if (!addresses) {
        throw new Error("Failed to fetch addresses");
      }
      setAddresses(addresses ?? []);
      await fetchBalance(Object.values(addresses));
      await fetchMneeBalance(Object.values(addresses));
    }
  };

  // {
  //   "approver": "032a51b458edf08c6126705614a11921c10989fdad0be30badb0bae5bba74e7c36",
  //   "fee_address": "1AUhxBh7bftDj9FEDBFSKLoAShTQBKaQ7b",
  //   "fees": [
  //     {
  //       "minAmt": 0,
  //       "maxAmt": 10000,
  //       "fee": 50
  //     },
  //     {
  //       "minAmt": 10001,
  //       "maxAmt": 18446744073709552000,
  //       "fee": 1000
  //     }
  //   ]
  // }

  const fetchBalance = async (addresses: string[]) => {
    try {
      // const utxos = await fetchUtxos(addresses);
      // const totalBalance = utxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0);

      console.log({ addresses });
      const balance = await wallet.getBalance();
      if (!balance) {
        throw new Error("Failed to fetch balance");
      }

      setBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const fetchMneeBalance = useCallback(async (addresses: string[]) => {
    try {
      console.log({ addresses });
      const utxos = await fetchMneeUtxos(addresses);
      const balance = (utxos).reduce((amt, o) => {
        return amt + o.data.bsv21.amt || 0;
      }, 0)

      setMneeBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [setMneeBalance]);

  useEffect(() => {
    const init = async () => {
      const config = await fetchConfig()
      setConfig(config);
    }
    if (wallet.isReady) {
      init();
    }
  }, [wallet, setConfig]);


  const { mutate: transferMNEE, status: mneeStatus, error: mneeError } = useMutation<
    { txid: string },
    Error,
    { recipient: string; amount: number; }
  >({
    mutationFn: async ({ recipient, amount }): Promise<{ txid: string }> => {
      if (!addresses) {
        throw new Error("Wallet not connected");
      }
      // Determine MNEE fee
      if (!config) {
        throw new Error("Config not fetched");
      }
      const tokenSatAmt = toTokenSat(amount, config.decimals);

      console.log({ recipient, amount, tokenSatAmt, config });

      const utxos = await fetchMneeUtxos(Object.values(addresses));

      const fee = config.fees.find(fee => amount >= fee.minAmt && amount <= fee.maxAmt)?.fee;
      if (fee === undefined) {
        throw new Error("Fee ranges inadequate");
      }

      // Build the transaction using the UTXOs, recipient, and amount
      const tx = new Transaction(1, [], [], 0);

      let tokensIn = 0;
      while (tokensIn < tokenSatAmt + fee) {
        const utxo = utxos.shift();
        if (!utxo) {
          throw new Error("Insufficient MNEE balance");
        }
        const sourceTransaction = await fetchTransaction(utxo.txid);
        if (!sourceTransaction) {
          throw new Error("Failed to fetch source transaction");
        }
        tx.addInput({
          sourceTXID: utxo.txid,
          sourceOutputIndex: utxo.vout,
          sourceTransaction,
          unlockingScript: new UnlockingScript(),
          // unlockingScriptTemplate: {
          //   sign: async () => {
          //     return new UnlockingScript();
          //   },
          //   estimateLength: async () => {
          //     return 0;
          //   },
          // },
        });

        tokensIn += utxo.data.bsv21.amt;
      }

      // Add output to the recipient
      const inscriptionData = { p: 'bsv-20', op: 'transfer', id: config.tokenId, amt: tokenSatAmt.toString() };
      const dataB64 = Buffer.from(JSON.stringify(inscriptionData)).toString("base64");
      tx.addOutput({
        // lockingScript: applyInscription(new P2PKHApprovedTemplate().lock(recipient, PublicKey.fromString(config.approver)), {
        lockingScript: applyInscription(new P2PKH().lock(recipient), {
          dataB64,
          contentType: "application/bsv-20"
        } as Inscription),
        satoshis: 1,
      })

      // Add the token fee output
      const feeInscriptionData = { p: 'bsv-20', op: 'transfer', id: config.tokenId, amt: fee.toString() };
      const feeDataB64 = Buffer.from(JSON.stringify(feeInscriptionData)).toString("base64");
      tx.addOutput({
        // lockingScript: applyInscription(new P2PKHApprovedTemplate().lock(config.feeAddress, PublicKey.fromString(config.approver)), {
        lockingScript: applyInscription(new P2PKH().lock(config.feeAddress), {
          dataB64: feeDataB64,
          contentType: "application/bsv-20"
        } as Inscription),
        satoshis: 1,
      })

      // Add the token change inscription
      const changeTokenSatAmt = tokensIn - tokenSatAmt - fee;
      const changeInscriptionData = { p: 'bsv-20', op: 'transfer', id: config.tokenId, amt: changeTokenSatAmt.toString() };
      const changeDataB64 = Buffer.from(JSON.stringify(changeInscriptionData)).toString("base64");
      tx.addOutput({
        // lockingScript: applyInscription(new P2PKHApprovedTemplate().lock(addresses.ordAddress, PublicKey.fromString(config.approver)), {
        lockingScript: applyInscription(new P2PKH().lock(addresses.ordAddress), {
          dataB64: changeDataB64,
          contentType: "application/bsv-20"
        } as Inscription),
        satoshis: 1,
      })

      debugger
      // Sign the transaction
      const sigRequests: SignatureRequest[] = [];
      for (const [index, input] of tx.inputs.entries()) {
        if (!input.sourceTransaction || !input.sourceTXID) {
          throw new Error("Source transaction not found");
        }
        sigRequests.push({
          prevTxid: input.sourceTXID,
          outputIndex: input.sourceOutputIndex,
          inputIndex: index,
          address: addresses.ordAddress,
          script: input.sourceTransaction.outputs[input.sourceOutputIndex].lockingScript.toHex(),
          satoshis: input.sourceTransaction.outputs[input.sourceOutputIndex].satoshis || 1,
        });
      }

      try {
        const rawtx = tx.toHex();

        const sigResponses: SignatureResponse[] | undefined = await wallet.getSignatures({
          rawtx,
          sigRequests,
        });

        if (!sigResponses) {
          throw new Error("Failed to get signatures");
        }

        // Apply signatures to the transaction
        for (const sigResponse of sigResponses) {
          const signedScript = new Script()
            .writeBin(toArray(sigResponse.sig, 'hex'))
            .writeBin(toArray(sigResponse.pubKey, 'hex'))
          tx.inputs[sigResponse.inputIndex].unlockingScript = signedScript;
        }

        console.log({ tx: tx.toHex() });
        // Submit the transaction
        debugger
        const response = await fetch(`${MNEE_API}/v1/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawtx: toBase64(tx.toBinary()) }),

        });
        if (!response.ok) {
          throw new Error("Transaction submission failed");
        }
        if (response) {
          toast.success("Transaction submitted successfully");
        }
        return response.json() as Promise<{ txid: string }>;

      } catch (error) {
        console.error("Error signing transaction:", error);
        throw error;
      }

    }
  });

  const isLoading = mneeStatus === "pending";

  const handleTransfer = useCallback(async () => {
    if (amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (!recipient) {
      alert("Please enter a recipient address.");
      return;
    }

    if (amount > mneeBalance) {
      alert("Insufficient MNEE balance.");
      return;
    }

    transferMNEE({ recipient, amount });
  }, [mneeBalance, transferMNEE, amount, recipient]);

  return (
    <div className="min-w-screen min-h-screen px-2 flex flex-col py-12">
      {!addresses && <div className="mx-auto">
        <button onClick={connectWallet} className="btn btn-primary">Connect Wallet</button>
      </div>}
      {addresses && (
        <>
          <div className="mx-auto mb-4 text-xs text-neutral">
            <p>BSV Address: {addresses.bsvAddress}</p>
            <p>ORD Address: {addresses.ordAddress}</p>
          </div>
          {config && <div className="mx-auto mb-4 flex flex-col items-center justify-center py-12">
            <>
              <h2 className="text-4xl"><span className="font-mono">{toToken(mneeBalance, config.decimals)}</span> MNEE</h2>
              <p className="text-neutral"><span className="font-mono">{balance ? toBitcoin(balance.satoshis) : '0'}</span> BSV</p>
            </>
          </div>}

          <div className="flex flex-col w-full max-w-md mx-auto p-4 bg-neutral rounded-lg">
            {/* Recipient Address */}
            <label htmlFor="recipient" className="text-sm font-semibold mb-2">
              Recipient Address
            </label>
            <input
              type="text"
              className="text-sm p-2 mb-2 rounded"
              placeholder="Recipient Address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            {/* Amount */}
            <label htmlFor="amount" className="text-sm font-semibold mb-2">
              Amount (MNEE)
            </label>
            <input
              name="amount"
              type="number"
              className="text-sm p-2 mb-2 rounded"
              placeholder={`Amount in Tokens`}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            {/* Send Button */}
            <button
              className="btn btn-primary"
              onClick={handleTransfer}
              disabled={isLoading}
            >
              Send MNEE
            </button>
          </div>
        </>
      )}
      {mneeError && <p className="mx-auto w-md bg-neutral p-2">Error: {mneeError.message} {mneeError.stack}</p>}
    </div>
  );
}
