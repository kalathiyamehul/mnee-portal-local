"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FaCopy, FaCircleInfo } from "react-icons/fa6";
import { FaQuestionCircle } from "react-icons/fa";
import { toToken, toTokenSat } from 'satoshi-token';
import type { Fee } from './admin/types';
import type { Config } from '@prisma/client';
import { ThemeSelector } from "@/components/ThemeSelector";
import { useBalance } from '@/contexts/BalanceContext';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { toast } from 'react-hot-toast';
import { fetchMneeUtxos, ingestTxid } from '@/utils/api';
import type { MNEEUtxo } from "@/types";
import { FetchStatus } from "@/types/common";

interface AddressCardProps {
	title: string;
	address: string;
	tooltip: string;
	source: string;
	balance?: number;
	isLoading?: boolean;
	decimals?: number;
	type?: 'bsv' | 'mnee';
}

const AddressCard = ({ title, address, tooltip, source, balance, isLoading, decimals = 8, type = 'bsv' }: AddressCardProps) => {
	return (
		<div className="bg-base-100 rounded-lg p-4 space-y-4 border-b border-base-content/10">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<div className="text-xs uppercase tracking-wider opacity-50">{title}</div>
					<div className="tooltip" data-tip={tooltip}>
						<FaCircleInfo className="w-3 h-3 text-base-content/70" />
					</div>
				</div>
				<a
					href={`https://whatsonchain.com/address/${address}`}
					target="_blank"
					rel="noopener noreferrer"
					className="btn btn-ghost btn-xs btn-square"
					title="View on WhatsOnChain"
				>
					<MdOutlineOpenInNew className="w-3 h-3" />
				</a>
			</div>

			<div className="flex items-center gap-2">
				<div className="font-mono text-xs break-all flex-1">
					{address}
				</div>
				<button
					type="button"
					onClick={() => {
						navigator.clipboard.writeText(address);
						toast.success('Address copied to clipboard');
					}}
					className="btn btn-ghost btn-xs btn-square flex-none"
					title="Copy address"
				>
					<FaCopy className="w-3 h-3" />
				</button>
			</div>

			<div className="flex justify-between items-center">
				<div className="text-xs uppercase tracking-wider opacity-50">Balance</div>
				<div className="text-lg font-bold">
					{isLoading ? (
						<span className="loading loading-spinner loading-sm" />
					) : (
						type === 'mnee' ? 
							`${toToken(balance || 0, decimals)} MNEE` :
							`${balance || 0} BSV`
					)}
				</div>
			</div>

			<div className="text-xs text-base-content/70">
				<span>Source: </span>
				<span className="font-mono">{source}</span>
			</div>
		</div>
	);
};

const TokenDetailsSection = ({ 
	config, 
	tokenDetails, 
}: { 
	config: Config; 
	tokenDetails: { sym: string; icon: string; amt: number; } | null;
}) => {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h3 className="text-lg font-bold">Token Details</h3>
			</div>

			{tokenDetails?.icon && (
				<div className="flex justify-center mb-6">
					<img 
						src={`https://ordfs.network/${tokenDetails.icon}`}
						alt={`${tokenDetails.sym} Icon`}
						className="w-24 h-24 rounded-lg"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = 'none';
						}}
					/>
				</div>
			)}

			<div className="grid grid-cols-2 gap-x-8">
				{/* Left Column */}
				<div className="space-y-4">
					{/* Token ID */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Token ID</span>
							<div className="tooltip tooltip-right" data-tip="Unique identifier for your token on the blockchain">
								<FaCircleInfo className="w-3 h-3 text-base-content/70" />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="font-mono text-xs">
								{config.tokenId.slice(0, 8)}...{config.tokenId.slice(-8)}
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => {
										navigator.clipboard.writeText(config.tokenId);
										toast.success('Token ID copied to clipboard');
									}}
									className="btn btn-ghost btn-xs btn-square"
								>
									<FaCopy className="w-3 h-3" />
								</button>
								<a
									href={`https://whatsonchain.com/tx/${config.tokenId.split('_')[0]}?tab=m8eqcrbs`}
									target="_blank"
									rel="noopener noreferrer"
									className="btn btn-ghost btn-xs btn-square"
									title="View on WhatsOnChain"
								>
									<MdOutlineOpenInNew className="w-3 h-3" />
								</a>
							</div>
						</div>
					</div>

					{/* Symbol */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Symbol</span>
							<div className="tooltip tooltip-right" data-tip="The token's ticker symbol">
								<FaCircleInfo className="w-3 h-3 text-base-content/70" />
							</div>
						</div>
						<div className="font-mono text-sm">
							{tokenDetails?.sym || 'MNEE'}
						</div>
					</div>

					{/* Decimals */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Decimals</span>
							<div className="tooltip tooltip-right" data-tip="Number of decimal places your token supports">
								<FaCircleInfo className="w-3 h-3 text-base-content/70" />
							</div>
						</div>
						<div className="font-mono text-sm">
							{config.decimals}
						</div>
					</div>
				</div>

				{/* Right Column */}
				<div className="space-y-4">
					{/* Total Supply */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Maximum Supply</span>
							<div className="tooltip tooltip-right" data-tip="Number of coins as per the deployment inscription.">
								<FaCircleInfo className="w-3 h-3 text-base-content/70" />
							</div>
						</div>
						<div className="font-mono text-sm">
							{tokenDetails ? toToken(tokenDetails.amt.toString(), config.decimals) : '0'} MNEE
						</div>
					</div>

					{/* Icon Field */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Icon Location</span>
							<div className="tooltip tooltip-right" data-tip="The ordfs.network location of the token's icon">
								<FaCircleInfo className="w-3 h-3 text-base-content/70" />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="font-mono text-xs">
								{tokenDetails?.icon || 'Not set'}
							</div>
							{tokenDetails?.icon && (
								<div className="flex items-center gap-1">
									<button
										type="button"
										onClick={() => {
											navigator.clipboard.writeText(tokenDetails.icon);
											toast.success('Icon location copied to clipboard');
										}}
										className="btn btn-ghost btn-xs btn-square"
									>
										<FaCopy className="w-3 h-3" />
									</button>
									<a
										href={`https://ordfs.network/${tokenDetails.icon}`}
										target="_blank"
										rel="noopener noreferrer"
										className="btn btn-ghost btn-xs btn-square"
										title="View on ordfs.network"
									>
										<MdOutlineOpenInNew className="w-3 h-3" />
									</a>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

const DashboardSettingsContent = () => {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeAddress, setFeeAddress] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { balances, balancesLoading } = useBalance();
  const [bsvBalances, setBsvBalances] = useState<{ [key: string]: number }>({});
  const [bsvLoading, setBsvLoading] = useState(false);
  const [tokenDetails, setTokenDetails] = useState<{
    sym: string;
    icon: string;
    amt: number;
  } | null>(null);
  const [burnUtxos, setBurnUtxos] = useState<MNEEUtxo[]>([]);
  const [burnLoading, setBurnLoading] = useState(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);

  // Calculate burn balance from UTXOs
  const burnBalance = useMemo(() => {
    return burnUtxos.reduce(
      (total, utxo) => total + Number(utxo.data.bsv21.amt),
      0
    );
  }, [burnUtxos]);

  // Fetch burn UTXOs
  const fetchBurnUtxos = useCallback(async (address: string) => {
    try {
      setBurnLoading(true);
      const utxos = await fetchMneeUtxos([address]);
      setBurnUtxos(utxos);
    } catch (error) {
      console.error("Error fetching burn UTXOs:", error);
    } finally {
      setBurnLoading(false);
    }
  }, []);

  const fetchBsvBalances = useCallback(async (addresses: string[]) => {
    try {
      setBsvLoading(true);
      const balances: { [key: string]: number } = {};

      for (const address of addresses) {
        try {
          const response = await fetch(
            `https://api.whatsonchain.com/v1/bsv/main/address/${address}/balance`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch balance");
          }
          const data = await response.json();
          // Convert satoshis to BSV
          balances[address] = data.confirmed / 1e8;
        } catch (error) {
          console.error(`Error fetching BSV balance for ${address}:`, error);
        }
      }

      setBsvBalances(balances);
    } catch (error) {
      console.error("Error fetching BSV balances:", error);
    } finally {
      setBsvLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        const data = (await response.json()) as Config;
        setConfig({
          ...data,
          fees: data.fees as Fee[],
        });
        setFeeAddress(data.feeAddress || "");

        // Fetch BSV balances for minter and cosigner addresses
        const addressesToCheck = [data.mintAddress];
        if (data.fundAddress) {
          addressesToCheck.push(data.fundAddress);
        }
        fetchBsvBalances(addressesToCheck);

        // Fetch burn UTXOs
        if (data.burnAddress) {
          fetchBurnUtxos(data.burnAddress);
        }

        // Fetch token details from the blockchain
        const [txid] = data.tokenId.split("_");
        const indexContext = await ingestTxid(txid);
        const tokenData = indexContext.txos[0].data.bsv21;
        setTokenDetails({
          sym: tokenData.sym,
          icon: tokenData.icon,
          amt: tokenData.amt,
        });
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [fetchBsvBalances, fetchBurnUtxos]);

  const handleSave = async (newFees?: Fee[]) => {
    try {
      setLoading(true);
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          fees: newFees || config?.fees,
          feeAddress: feeAddress,
        }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to save configuration");
      }

      toast.success("Configuration saved successfully");
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save configuration"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4">
        <div className="alert alert-error">No configuration found</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Settings</h1>
        <ThemeSelector />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12">
        {/* Left Column - Token Details and Fee Structure */}
        <div className="space-y-12">
          {/* Token Details */}
          {config && tokenDetails && (
            <TokenDetailsSection config={config} tokenDetails={tokenDetails} />
          )}

          {/* Fee Structure */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Fee Structure</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {(config.fees as Fee[])?.map((fee, index) => (
                    <tr key={`${fee.min}-${fee.max}`}>
                      <td>
                        {toToken(fee.min, config.decimals)} MNEE -{" "}
                        {fee.max === Number.MAX_SAFE_INTEGER
                          ? "∞"
                          : `${toToken(fee.max, config.decimals)} MNEE`}
                      </td>
                      <td>{toToken(fee.fee, config.decimals)} MNEE</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Super Admin Config Values */}
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Super Admin Config</h3>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowSuperAdminModal(true)}
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-medium">No. of Approval</div>
                <div>{config.noOfApproval}</div>
              </div>
              <div>
                <div className="font-medium">Global JSON</div>
                <pre className="bg-base-200 rounded p-2 text-xs overflow-x-auto max-h-32">
                  {JSON.stringify(config.globalJson, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - System Addresses */}
        <div className="space-y-4 w-full lg:w-96 border-l pl-8 border-base-200">
          <h3 className="text-lg font-bold">System Addresses</h3>
          {/* Fee Address */}
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Fee Address</span>
                  <div
                    className="tooltip"
                    data-tip="Address where transaction fees are collected (MNEE)"
                  >
                    <FaQuestionCircle className="text-base-content/60" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={feeAddress}
                  onChange={(e) => setFeeAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setFeeAddress(config?.feeAddress || "");
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleSave()}
                  disabled={loading}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <AddressCard
              title="Fee Address"
              address={config?.feeAddress || ""}
              tooltip="Address where transaction fees are collected (MNEE)"
              source="Configuration"
              balance={balances[config?.feeAddress || ""]}
              isLoading={balancesLoading === FetchStatus.LOADING}
              decimals={config?.decimals}
              type="mnee"
            />
          )}

          {/* Minter Address */}
          <AddressCard
            title="Minter Address"
            address={config?.mintAddress || ""}
            tooltip="Address that will pay for minting/burning tokens (BSV)"
            source="MINT_WIF environment variable"
            balance={bsvBalances[config?.mintAddress || ""]}
            isLoading={bsvLoading}
            type="bsv"
          />

          {/* Burn Address */}
          <AddressCard
            title="Burn Address"
            address={config?.burnAddress || ""}
            tooltip="Address to send burned tokens (MNEE)"
            source="BURN_WIF environment variable"
            balance={burnBalance}
            isLoading={burnLoading}
            decimals={config?.decimals}
            type="mnee"
          />

          {/* Cosigner Address */}
          {config?.fundAddress && (
            <AddressCard
              title="Cosigner Address"
              address={config.fundAddress}
              tooltip="Address of the key that signs and funds MNEE transfers (BSV)"
              source="APPROVER_WIF environment variable on the cosigner"
              balance={bsvBalances[config.fundAddress]}
              isLoading={bsvLoading}
              type="bsv"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSettingsContent;
