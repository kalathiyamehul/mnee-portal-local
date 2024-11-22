// app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Addresses, Balance, SendBsv, SendBsvResponse, SignatureRequest, SignatureResponse, useYoursWallet } from "yours-wallet-provider";
import { useMutation } from "@tanstack/react-query";
import { Transaction } from "@bsv/sdk";
// import P2PKHApprovedTemplate from "@/templates/p2pkhApproved";
import { toBitcoin, toSatoshi, toToken, toTokenSat } from "satoshi-token";
import { toast } from "react-hot-toast";

const MNEE_API = Bun.env.MNEE_API;

export default function Dashboard() {
  const wallet = useYoursWallet();
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [mneeBalance, setMneeBalance] = useState<number>(0);
  const [balance, setBalance] = useState<Balance | undefined>();
  const [recipient, setRecipient] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);

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
    }
  };

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
    return response.json();
  };

  const fetchBalance = async (addresses: string[]) => {
    try {
      // const utxos = await fetchUtxos(addresses);
      // const totalBalance = utxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0);

      const balance = await wallet.getBalance();
      if (!balance) {
        throw new Error("Failed to fetch balance");
      }

      setBalance(balance);
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

      const utxos = await fetchMneeUtxos(Object.values(addresses));

      // Build the transaction using the UTXOs, recipient, and amount
      const tx = new Transaction();


      // Add inputs from UTXOs
      for (const utxo of utxos) {
        tx.addInput({
          sourceTXID: utxo.txid,
          sourceOutputIndex: utxo.outputIndex,
          // unlockingScriptTemplate: P2PKHApprovedTemplate,
          // satoshis: utxo.satoshis,
        });
      }

      // Add output to the recipient
      // tx.addOutput({
      //   lockingScript: P2PKHApprovedTemplate.lockingScript(recipient),
      //   satoshis: amount,
      // })

      // Add change output back to sender if necessary
      const totalInput = utxos.reduce((sum: number, utxo: any) => sum + utxo.satoshis, 0);
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

  const isLoading = mneeStatus === "pending" || status === "pending";

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