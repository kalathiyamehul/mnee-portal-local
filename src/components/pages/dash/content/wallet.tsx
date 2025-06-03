"use client";

import { useState, useCallback, useEffect } from "react";
import {
  type Addresses,
  type Balance,
  type SignatureRequest,
  type SignatureResponse,
  useYoursWallet,
} from "yours-wallet-provider";
import { useMutation } from "@tanstack/react-query";
import {
  PublicKey,
  Script,
  Transaction,
  TransactionSignature,
  UnlockingScript,
  Utils
} from "@bsv/sdk";
import { toToken, toTokenSat } from "satoshi-token";
import { applyInscription, type Inscription } from "js-1sat-ord";
import toast from "react-hot-toast";
import type { Config } from "../../../../types";
import {
  fetchConfig,
  fetchMneeUtxos,
  fetchTransaction,
} from "@/utils/api";
import CosignTemplate from "@/templates/cosign";
import { FaSpinner } from "react-icons/fa";
import { MNEE_API } from "@/env";
import { DepositModal } from './modals/DepositModal';
import { useRouter } from "next/navigation";
import { useBalance } from '@/contexts/BalanceContext';
import { FetchStatus } from "@/types/common";

const { toArray, toBase64 } = Utils;

interface DashboardWalletContentProps {
  defaultShowTransfer?: boolean;
  defaultAddress?: string;
}

export default function DashboardWalletContent({ defaultShowTransfer, defaultAddress }: DashboardWalletContentProps = {}) {
  const wallet = useYoursWallet();
  const [addresses, setAddresses] = useState<Addresses | null>(null);
  const [balance, setBalance] = useState<Balance | undefined>();
  const { balances, fetchBalances, balancesLoading } = useBalance();
  const [config, setConfig] = useState<Config | null>(null);
  const [showBsvDepositModal, setShowBsvDepositModal] = useState(false);
  const [showMneeDepositModal, setShowMneeDepositModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(defaultShowTransfer || false);
  const [recipient, setRecipient] = useState(defaultAddress || "");
  const [amount, setAmount] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (defaultShowTransfer) {
      setShowTransferModal(true);
    }
    if (defaultAddress) {
      setRecipient(defaultAddress);
    }
  }, [defaultShowTransfer, defaultAddress]);

  const handleCloseTransferModal = useCallback(() => {
    setShowTransferModal(false);
    router.push('/dash/wallet');
  }, [router]);

  useEffect(() => {
    if (!showTransferModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseTransferModal();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [handleCloseTransferModal, showTransferModal]);

  const connectWallet = async () => {
    try {
      if (!wallet.isReady) {
        toast.error("Please install the Yours Wallet extension first");
        window.open("https://yours.org", "_blank");
        return;
      }
      const pubKey = await wallet.connect();
      if (pubKey) {
        const addresses = await wallet.getAddresses();

        // make sure addresses are not empty strings
        if (!addresses || Object.values(addresses).some(addr => addr === "")) {
          throw new Error("Failed to get valid wallet addresses");
        }
        setAddresses(addresses ?? []);
        // Fetch MNEE balances immediately after getting addresses
        await fetchBalances(Object.values(addresses));
        toast.success("Wallet connected successfully");
      }
    } catch (error) {
      // console.error("Error connecting wallet:", error);
      toast.error(`Failed to connect wallet: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Effect for BSV balance
  useEffect(() => {
    let mounted = true;

    const fetchBsvBalance = async () => {
      if (!addresses || !wallet.isReady) {
        return;
      }

      try {
        const balance = await wallet.getBalance();
        if (!balance || !mounted) return;
        setBalance(balance);
      } catch (error) {
        if (!mounted) return;
        // console.error("Error fetching BSV balance:", error);
        toast.error(`Failed to fetch BSV balance: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };

    fetchBsvBalance();

    return () => {
      mounted = false;
    };
  }, [wallet, addresses]);

  // Effect for MNEE balance
  useEffect(() => {
    if (!addresses || !wallet.isReady || balancesLoading === FetchStatus.LOADING) {
      return;
    }

    // Check if we have valid addresses (not empty strings)
    const validAddresses = Object.values(addresses).filter(addr => addr !== "");
    if (validAddresses.length === 0) {
      return;
    }

    const fire = async () => {
      await fetchBalances(validAddresses);
    };
    
    if (balancesLoading === FetchStatus.IDLE) {
      fire();
    }
  }, [wallet, addresses, fetchBalances, balancesLoading]);

  useEffect(() => {
    const init = async () => {
      // Fetching remote config
      const config = await fetchConfig();
      setConfig(config);
    };
    if (wallet.isReady) {
      init();
    }
  }, [wallet]);

  const {
    mutate: transferMNEE,
    status: mneeStatus,
    error: mneeError,
  } = useMutation<
    { rawtx: string },
    Error,
    { recipient: string; amount: number }
  >({
    mutationFn: async ({ recipient, amount }): Promise<{ rawtx: string }> => {
      if (!addresses) {
        throw new Error("Wallet not connected");
      }
      // Determine MNEE fee
      if (!config) {
        throw new Error("Config not fetched");
      }
      const tokenSatAmt = toTokenSat(amount, config.decimals);

      // Fetch UTXOs from all addresses to ensure we capture the total available balance
      const utxos = await fetchMneeUtxos(Object.values(addresses));

      // Validate that we have enough UTXOs before proceeding
      const totalUtxoAmount = utxos.reduce((sum, utxo) => sum + (utxo.data.bsv21.amt || 0), 0);
      if (totalUtxoAmount < tokenSatAmt) {
        throw new Error("Insufficient MNEE balance");
      }

      // No fee required when sending to burn address
      let fee: number;
      if (recipient === config.burnAddress) {
        fee = 0;
      } else {
        const foundFee = config.fees.find(
          (fee) => tokenSatAmt >= fee.min && tokenSatAmt <= fee.max,
        )?.fee;
        if (foundFee === undefined) {
          throw new Error("Fee ranges inadequate");
        }
        fee = foundFee;
      }

      // Build the transaction using the UTXOs, recipient, and amount
      const tx = new Transaction(1, [], [], 0);

      // Track total tokens from UTXOs and which addresses we need to sign for
      let tokensIn = 0;
      const signingAddresses: string[] = [];
      while (tokensIn < tokenSatAmt + fee) {
        const utxo = utxos.shift();
        if (!utxo) {
          throw new Error("Insufficient MNEE balance");
        }
        const sourceTransaction = await fetchTransaction(utxo.txid);
        if (!sourceTransaction) {
          throw new Error("Failed to fetch source transaction");
        }

        signingAddresses.push(utxo.owners[0]);

        tx.addInput({
          sourceTXID: utxo.txid,
          sourceOutputIndex: utxo.vout,
          sourceTransaction,
          unlockingScript: new UnlockingScript(),
        });

        tokensIn += utxo.data.bsv21.amt;
      }

      // Add output to the recipient
      const inscriptionData = {
        p: "bsv-20",
        op: "transfer",
        id: config.tokenId,
        amt: tokenSatAmt.toString(),
      };
      const dataB64 = Buffer.from(JSON.stringify(inscriptionData)).toString(
        "base64",
      );
      tx.addOutput({
        lockingScript: applyInscription(
          new CosignTemplate().lock(
            recipient,
            PublicKey.fromString(config.approver),
          ),
          {
            // lockingScript: applyInscription(new P2PKH().lock(recipient), {
            dataB64,
            contentType: "application/bsv-20",
          } as Inscription,
        ),
        satoshis: 1,
      });

      // Add the token fee output
      if (fee > 0) {  // Only add fee output if there is a fee
        const feeInscriptionData = {
          p: "bsv-20",
          op: "transfer",
          id: config.tokenId,
          amt: fee.toString(),
        };
        const feeDataB64 = Buffer.from(
          JSON.stringify(feeInscriptionData),
        ).toString("base64");
        tx.addOutput({
          lockingScript: applyInscription(
            new CosignTemplate().lock(
              config.feeAddress,
              PublicKey.fromString(config.approver),
            ),
            {
              // lockingScript: applyInscription(new P2PKH().lock(config.feeAddress), {
              dataB64: feeDataB64,
              contentType: "application/bsv-20",
            } as Inscription,
          ),
          satoshis: 1,
        });
      }

      // Add the token change inscription
      const changeTokenSatAmt = tokensIn - tokenSatAmt - fee;
      const changeInscriptionData = {
        p: "bsv-20",
        op: "transfer",
        id: config.tokenId,
        amt: changeTokenSatAmt.toString(),
      };
      const changeDataB64 = Buffer.from(
        JSON.stringify(changeInscriptionData),
      ).toString("base64");
      tx.addOutput({
        lockingScript: applyInscription(
          new CosignTemplate().lock(
            addresses.ordAddress,
            PublicKey.fromString(config.approver),
          ),
          {
            // lockingScript: applyInscription(new P2PKH().lock(addresses.ordAddress), {
            dataB64: changeDataB64,
            contentType: "application/bsv-20",
          } as Inscription,
        ),
        satoshis: 1,
      });

      // Sign the transaction
      const sigRequests: SignatureRequest[] = [];
      for (const [index, input] of tx.inputs.entries()) {
        if (!input.sourceTransaction || !input.sourceTXID) {
          throw new Error("Source transaction not found");
        }

        const addressToUse = signingAddresses[index];

        sigRequests.push({
          prevTxid: input.sourceTXID,
          outputIndex: input.sourceOutputIndex,
          inputIndex: index,
          address: addressToUse,
          script:
            input.sourceTransaction.outputs[
              input.sourceOutputIndex
            ].lockingScript.toHex(),
          satoshis:
            input.sourceTransaction.outputs[input.sourceOutputIndex].satoshis ||
            1,
          sigHashType:
            TransactionSignature.SIGHASH_ALL |
            TransactionSignature.SIGHASH_ANYONECANPAY |
            TransactionSignature.SIGHASH_FORKID,
        });
      }

      try {
        const rawtx = tx.toHex();

        const sigResponses: SignatureResponse[] | undefined =
          await wallet.getSignatures({
            rawtx,
            sigRequests,
          });

        if (!sigResponses) {
          throw new Error("Failed to get signatures");
        }

        // Apply signatures to the transaction
        for (const sigResponse of sigResponses) {
          const signedScript = new Script()
            .writeBin(toArray(sigResponse.sig, "hex"))
            .writeBin(toArray(sigResponse.pubKey, "hex"));
          tx.inputs[sigResponse.inputIndex].unlockingScript = signedScript;
        }

        // Submit the transaction
        const response = await fetch(`${MNEE_API}/v1/transfer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawtx: toBase64(tx.toBinary()) }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));

          // Handle specific status codes
          switch (response.status) {
            case 423:
              if (errorData.message?.includes("frozen")) {
                throw new Error("Your address is currently frozen and cannot send tokens");
              }
              if (errorData.message?.includes("blacklisted")) {
                throw new Error("The recipient address is blacklisted and cannot receive tokens");
              }
              throw new Error("Transaction blocked: Address is either frozen or blacklisted");

            case 503:
              if (errorData.message?.includes("cosigner is paused")) {
                throw new Error("Token transfers are currently paused by the administrator");
              }
              throw new Error(errorData.message || "Service temporarily unavailable");
            default:
              throw new Error(errorData.message || "Transaction submission failed");
          }
        }

        // rawtx is base64 encoded
        return response.json() as Promise<{ rawtx: string }>;
      } catch (error) {
        // console.error("Error signing/submitting transaction:", error);
        toast.error("Error signing/submitting transaction");
        throw error;
      }
    },
    onSuccess: async (data) => {
      const { rawtx } = data;
      const tx = Transaction.fromBinary(toArray(rawtx, "base64"));
      if (!rawtx || !tx) {
        throw new Error("Something went wrong");
      }
      const addresses = await wallet.getAddresses();
      if (!addresses) {
        throw new Error("Wallet not connected");
      }
      // update utxos
      await fetchBalances(Object.values(addresses));

      setRecipient("");
      setAmount("");

      toast.success("Transfer complete");

      // close the modal
      setShowTransferModal(false);
      router.replace('/dash/wallet');
    },
    onError: (error) => {
      // console.error("Transfer error:", error);

      // Handle specific error messages with more user-friendly text
      let errorMessage = error.message;
      if (errorMessage.includes("frozen")) {
        errorMessage = "Your address is currently frozen and cannot send tokens";
      } else if (errorMessage.includes("blacklisted")) {
        errorMessage = "The recipient address is blacklisted and cannot receive tokens";
      } else if (errorMessage.includes("Insufficient")) {
        errorMessage = "You don't have enough MNEE tokens for this transfer";
      } else if (errorMessage.includes("cosigner is paused")) {
        errorMessage = "Token transfers are currently paused by the administrator";
      }

      toast.error(errorMessage);
    },
  });

  const isLoading = mneeStatus === "pending";

  const handleTransfer = useCallback(async () => {
    try {
      if (!config) {
        toast.error("Token configuration not loaded");
        return;
      }

      const numAmount = Number(amount);
      if (numAmount <= 0 || Number.isNaN(numAmount)) {
        toast.error("Please enter a valid amount greater than 0");
        return;
      }

      if (!recipient) {
        toast.error("Please enter a recipient address");
        return;
      }

      // Calculate total MNEE balance across all addresses
      const totalBalance = addresses ? Object.values(addresses).reduce((sum, addr) => sum + (balances[addr] || 0), 0) : 0;
      if (numAmount > toToken(totalBalance, config.decimals)) {
        toast.error("Insufficient MNEE balance");
        return;
      }

      // Validate recipient address format
      if (!RegExp(/^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/).exec(recipient)) {
        toast.error("Invalid recipient address format");
        return;
      }

      transferMNEE({ recipient, amount: numAmount });
    } catch (error) {
      // console.error("Error in transfer:", error);
      toast.error(`Transfer failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [addresses, balances, transferMNEE, amount, recipient, config]);

  const canTransfer = useCallback(() => {
    if (!config || !balance || !addresses) return false;

    // If amount is not set or invalid
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0 || Number.isNaN(numAmount)) return false;

    // Check total MNEE balance across all addresses
    const totalBalance = Object.values(addresses).reduce((sum, addr) => sum + (balances[addr] || 0), 0);
    const mneeTokens = toToken(totalBalance, config.decimals);
    if (numAmount > mneeTokens) return false;

    // Check recipient
    if (!recipient || !RegExp(/^[1][a-km-zA-HJ-NP-Z1-9]{25,34}$/).exec(recipient)) return false;

    return true;
  }, [amount, balance, config, balances, addresses, recipient]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {!addresses && (
        <div className="mx-auto">
          <button
            type="button"
            onClick={connectWallet}
            className="btn btn-primary"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {addresses && (
        <>
          <div className="stats bg-base-200 w-full">
            <div className="stat">
              <div className="stat-title">BSV Balance</div>
              <div className="stat-value">{balance?.bsv || 0} BSV</div>
              <div className="stat-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowBsvDepositModal(true)}
                >
                  Deposit
                </button>
              </div>
            </div>

            <div className="stat">
              <div className="stat-title">MNEE Balance</div>
              <div className="stat-value">
                {balancesLoading === FetchStatus.LOADING ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  `${config ? toToken(Object.values(addresses).reduce((sum, addr) => sum + (balances[addr] || 0), 0), config.decimals) : 0} MNEE`
                )}
              </div>
              <div className="stat-actions flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowMneeDepositModal(true)}
                >
                  Deposit
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    router.push('/dash/wallet?showTransfer=true');
                    setShowTransferModal(true);
                  }}
                >
                  Transfer
                </button>
              </div>
            </div>
          </div>

          {/* Deposit Modals */}
          {showBsvDepositModal && (
            <DepositModal
              title="Deposit BSV"
              onClose={() => setShowBsvDepositModal(false)}
              address={addresses.bsvAddress}
            />
          )}

          {showMneeDepositModal && (
            <DepositModal
              title="Deposit MNEE"
              onClose={() => setShowMneeDepositModal(false)}
              address={addresses.ordAddress}
            />
          )}

          {/* Transfer Modal */}
          {showTransferModal && (
            <dialog id="transfer_modal" className="modal modal-open">
              <div className="modal-box max-w-sm">
                <h3 className="text-lg font-bold mb-6">Transfer MNEE</h3>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  handleTransfer();
                }}>
                  <div className="space-y-4">
                    <label className="form-control w-full">
                      <div className="label">
                        <span className="label-text">Recipient Address</span>
                      </div>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder="Enter recipient address"
                        required
                      />
                    </label>

                    <label className="form-control w-full">
                      <div className="label">
                        <span className="label-text">Amount</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="input input-bordered w-full"
                        value={amount}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow numbers and a single decimal point
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            // Check decimal places
                            const parts = value.split('.');
                            if (parts.length === 2 && config) {
                              // If we have decimals, check if they exceed the allowed length
                              if (parts[1].length > config.decimals) {
                                return;
                              }
                            }
                            setAmount(value);
                          }
                        }}
                        placeholder={`Enter amount (max ${config?.decimals || 8} decimal places)`}
                        required
                      />
                    </label>
                  </div>

                  <div className="modal-action">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setShowTransferModal(false);
                        router.push('/dash/wallet');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={isLoading || !canTransfer()}
                    >
                      {isLoading ? (
                        <>
                          <FaSpinner className="animate-spin mr-2" />
                          Sending...
                        </>
                      ) : (
                        'Send'
                      )}
                    </button>
                  </div>
                </form>
              </div>
              <form method="dialog" className="modal-backdrop" onClick={() => {
                setShowTransferModal(false);
                router.push('/dash/wallet');
              }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowTransferModal(false);
                    router.push('/dash/wallet');
                  }}
                >
                  close
                </button>
              </form>
            </dialog>
          )}

          {!canTransfer() && amount && (
            <div className="text-sm text-error mt-2">
              {Number(amount) > (config && addresses ? toToken(Object.values(addresses).reduce((sum, addr) => sum + (balances[addr] || 0), 0), config.decimals) : 0) ? (
                <>
                  Insufficient MNEE balance (
                  {config && addresses ? `${toToken(Object.values(addresses).reduce((sum, addr) => sum + (balances[addr] || 0), 0), config.decimals)} MNEE available` : '0 MNEE available'}
                  , trying to send {amount} MNEE)
                </>
              ) : !recipient || !recipient.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) ? (
                "Invalid recipient address"
              ) : (
                "Invalid amount"
              )}
            </div>
          )}

          {mneeError && (
            <div className="mx-auto mt-4 max-w-md w-full">
              <div className="bg-error/10 border border-error text-error p-4 rounded-lg">
                <p className="font-semibold mb-1">Transaction Failed</p>
                <p className="text-sm">{mneeError.message}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
