// app/page.tsx
"use client";

import { useState, useCallback } from "react";
import { Addresses, Balance, Ordinal, useYoursWallet } from "yours-wallet-provider";
import { useMutation } from "@tanstack/react-query";
import { PublicKey, Transaction } from "@bsv/sdk";
// import P2PKHApprovedTemplate from "@/templates/p2pkhApproved";
import { toBitcoin, toToken } from "satoshi-token";
import { toast } from "react-hot-toast";
import P2PKHApprovedTemplate from "@/templates/p2pkhApproved";

type MNEEUtxo = {
  height: number;
  idx: number;
  script: string;
  outpoint: string;
  txid: string;
  vout: number;
  satoshis: number;
  data: {
    bsv21: {
      amt: string;
      dec: number;
      icon: string;
      id: string;
      op: string;
      sym: string;
    };
  }
};

const MNEE_API = process.env.REACT_APP_MNEE_API;

export default function Dashboard() {
  const wallet = useYoursWallet();
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [mneeBalance, setMneeBalance] = useState<number>(0);
  const [balance, setBalance] = useState<Balance | undefined>();
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [mneeUtxos, setMneeUtxos] = useState<MNEEUtxo[]>([]);

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

  type Config = {
    approver: string;
    fee_address: string;
    fees: {
      minAmt: number;
      maxAmt: number;
      fee: number;
    }[];
  };

  const fetchConfig = async () => {
    const response = await fetch(`${MNEE_API}/v1/config`);
    if (!response.ok) {
      throw new Error("Failed to fetch config");
    }
    return await response.json() as Config;
  }

  const fetchMneeUtxos = async (addresses: string[]) => {
    if (!MNEE_API) {
      throw new Error("MNEE_API not defined");
    }

    const response = await fetch(`${MNEE_API}/v1/utxos/`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addresses),
    });
    if (!response.ok) {
      throw new Error("Failed to fetch UTXOs");
    }
    return await response.json() as MNEEUtxo[];
  };

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


  const fetchMneeBalance = async (addresses: string[]) => {
    try {
      // const utxos = await fetchUtxos(addresses);
      // const totalBalance = utxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0);

      console.log({ addresses });
      const ordinals = await wallet.getOrdinals();
      if (!ordinals) {
        throw new Error("Failed to fetch balance");
      }

      const balance = (ordinals as Ordinal[]).reduce((amt, o) => {
        return amt + toToken(o.data?.bsv20?.amt || 0, o.data?.bsv20?.dec || 0);
      }, 0)

      setMneeBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  const { mutate: transferMNEE, status: mneeStatus, error: mneeError } = useMutation<
    { txid: string },
    Error,
    { recipient: string; amount: number }
  >({
    mutationFn: async ({ recipient, amount }): Promise<{ txid: string }> => {
      if (!addresses) {
        throw new Error("Wallet not connected");
      }

      console.log({ recipient, amount });

      const utxos = await fetchMneeUtxos(Object.values(addresses));

      // Determine MNEE fee

      const config = await fetchConfig()

      // find which fee to use
      const fee = config.fees.find(fee => amount >= fee.minAmt && amount <= fee.maxAmt)?.fee;
      if (fee === undefined) {
        throw new Error("Fee ranges inadequate");
      }

      // Build the transaction using the UTXOs, recipient, and amount
      const tx = new Transaction();

      let tokensIn = 0;
      while (tokensIn < amount + fee) {
        let utxo = utxos.shift();
        if (!utxo) {
          throw new Error("Insufficient MNEE balance");
        }
        tx.addInput({
          sourceTXID: utxo.txid,
          sourceOutputIndex: utxo.vout,
          // unlockingScriptTemplate: P2PKHApprovedTemplate,
          // satoshis: utxo.satoshis,
        });

        tokensIn += Number.parseInt(utxo.data.bsv21.amt);
      }


      // Add output to the recipient
      // tx.addOutput({
      //   lockingScript: applyInscription(new P2PKHApprovedTemplate().lock(recipient, PublicKey.fromString(config.approver)),
      //   satoshis: amount,
      // })

      // Add change output back to sender if necessary
      //  const totalInput = utxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0);
      await tx.fee(); // You may need to define fee estimation
      // const change = totalInput - amount - fee;
      // if (change > 0) {
      //   tx.change(address);
      // }

      // Sign the transaction
      // const sigRequests: SignatureRequest[] = tx.inputs.map((input, index) => ({
      //   prevTxid: input.sourceTXID,
      //   outputIndex: input.sourceOutputIndex,
      //   inputIndex: index,
      //   satoshis: input.output.satoshis,
      //   address: address!,
      //   script: input.output.script.toHex(),
      // }));

      // const sigResponses: SignatureResponse[] = await wallet.getSignatures({
      //   rawtx: tx.toHex(),
      //   format: 'tx',
      //   sigRequests,
      // });

      // Apply signatures to the transaction
      // sigResponses.forEach((sigResponse, index) => {
      //   tx.inputs[index].unlockingScript = sigResponse.script;
      // });

      // Submit the transaction
      const response = await fetch("/v1/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTx: tx.toHex() }),
      });
      if (!response.ok) {
        throw new Error("Transaction submission failed");
      }
      if (response) {
        toast.success("Transaction submitted successfully");
      }
      return response.json() as Promise<{ txid: string }>;
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
          <div className="mx-auto mb-4 flex flex-col items-center justify-center py-12">
            <>
              <h2 className="text-4xl"><span className="font-mono">{toToken(mneeBalance, 5)}</span> MNEE</h2>
              <p className="text-neutral"><span className="font-mono">{balance ? toBitcoin(balance.satoshis) : '0'}</span> BSV</p>
            </>
          </div>

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
      {mneeError && <p>Error: {mneeError.message}</p>}
    </div>
  );
}