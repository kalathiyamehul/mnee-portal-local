"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FaPlus, FaTrash, FaQuestionCircle, FaPencilAlt } from "react-icons/fa";
import { toToken } from 'satoshi-token';
import { Fee, ConfigWithFees } from './admin/types';
import { Config } from '@prisma/client';
import { ThemeSelector } from "@/components/ThemeSelector";
import { useBalance } from '@/contexts/BalanceContext';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { FaCopy } from 'react-icons/fa6';
import { toast } from 'react-hot-toast';
import { ingestTxid } from '@/utils/api';
import { useSystemStatus } from "@/contexts/SystemStatusContext";

interface EditFeesModalProps {
	fees: Fee[];
	onSave: (fees: Fee[]) => void;
	onClose: () => void;
}

const EditFeesModal = ({ fees: initialFees, onSave, onClose }: EditFeesModalProps) => {
	const [fees, setFees] = useState<Fee[]>(initialFees);
	const [newFee, setNewFee] = useState<Fee>({ min: 0, max: 0, fee: 0 });
	const [config, setConfig] = useState<Config | null>(null);

	// Fetch config to get decimals
	useEffect(() => {
		const fetchConfig = async () => {
			const response = await fetch('/api/config');
			const data = await response.json();
			setConfig(data);
		};
		fetchConfig();
	}, []);

	const handleAddFee = () => {
		if (newFee.min >= 0 && newFee.max > newFee.min && newFee.fee >= 0) {
			setFees([...fees, newFee]);
			setNewFee({ min: 0, max: 0, fee: 0 });
		}
	};

	const handleRemoveFee = (index: number) => {
		setFees(fees.filter((_, i) => i !== index));
	};

	if (!config) {
		return (
			<dialog id="edit_fees_modal" className="modal modal-open">
				<div className="modal-box flex justify-center items-center">
					<span className="loading loading-spinner loading-lg"></span>
				</div>
			</dialog>
		);
	}

	return (
		<dialog id="edit_fees_modal" className="modal modal-open" onClick={(e) => {
			if (e.target === e.currentTarget) {
				onClose();
			}
		}}>
			<div className="modal-box">
				<h3 className="font-bold text-lg mb-4">Edit Fee Structure</h3>
				
				{/* Existing Fees */}
				<div className="mb-6">
					<h4 className="text-md mb-3">Current Fees</h4>
					<div className="space-y-2">
						{fees.map((fee, index) => (
							<div key={index} className="flex items-start justify-between bg-base-300 p-3 rounded">
								<div className="grid gap-1">
									<div className="grid grid-cols-[4rem_1fr] gap-2">
										<span className="text-base-content/70">Min:</span>
										<span className="font-medium">{toToken(fee.min.toString(), config.decimals)} MNEE</span>
									</div>
									<div className="grid grid-cols-[4rem_1fr] gap-2">
										<span className="text-base-content/70">Max:</span>
										<span className="font-medium">{fee.max === Number.MAX_SAFE_INTEGER ? '∞' : toToken(fee.max.toString(), config.decimals)} MNEE</span>
									</div>
									<div className="grid grid-cols-[4rem_1fr] gap-2">
										<span className="text-base-content/70">Fee:</span>
										<span className="font-medium">{toToken(fee.fee.toString(), config.decimals)} MNEE</span>
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleRemoveFee(index)}
									className="btn btn-ghost btn-sm text-error"
								>
									<FaTrash />
								</button>
							</div>
						))}
					</div>
				</div>

				{/* Add New Fee */}
				<div className="form-control">
					<h4 className="text-md mb-3">Add New Fee</h4>
					<div className="grid grid-cols-3 gap-3">
						<div>
							<label className="label">
								<span className="label-text">Min</span>
							</label>
							<label className="input input-bordered flex items-center gap-2">
								<input
									type="text"
									className="grow"
									value={newFee.min === 0 ? '' : toToken(newFee.min.toString(), config.decimals)}
									placeholder="0"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setNewFee({ ...newFee, min: 0 });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setNewFee({ ...newFee, min: satAmount });
									}}
								/>
								<span className="badge badge-ghost">MNEE</span>
							</label>
						</div>
						<div>
							<label className="label">
								<span className="label-text">Max</span>
							</label>
							<label className="input input-bordered flex items-center gap-2">
								<input
									type="text"
									className="grow"
									value={newFee.max === Number.MAX_SAFE_INTEGER ? '' : toToken(newFee.max.toString(), config.decimals)}
									placeholder="∞"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setNewFee({ ...newFee, max: Number.MAX_SAFE_INTEGER });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setNewFee({ ...newFee, max: satAmount });
									}}
								/>
								<span className="badge badge-ghost">MNEE</span>
							</label>
						</div>
						<div>
							<label className="label">
								<span className="label-text">Fee</span>
							</label>
							<label className="input input-bordered flex items-center gap-2">
								<input
									type="text"
									className="grow"
									value={newFee.fee === 0 ? '' : toToken(newFee.fee.toString(), config.decimals)}
									placeholder="0"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setNewFee({ ...newFee, fee: 0 });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setNewFee({ ...newFee, fee: satAmount });
									}}
								/>
								<span className="badge badge-ghost">MNEE</span>
							</label>
						</div>
					</div>
					<button
						type="button"
						onClick={handleAddFee}
							className="btn btn-primary mt-4"
							disabled={newFee.min >= newFee.max}
						>
						<FaPlus className="mr-2" /> Add Fee
					</button>
				</div>

				<div className="modal-action">
					<button type="button" className="btn" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary"
						onClick={() => {
							onSave(fees);
							onClose();
						}}
					>
						Save Changes
					</button>
				</div>
			</div>
		</dialog>
	);
};

const AddressCard = ({ 
	title, 
	address, 
	tooltip, 
	source, 
	balance,
	isLoading,
	decimals,
	showBalance = true,
	onEdit,
	type = 'mnee'
}: { 
	title: string;
	address: string;
	tooltip: string;
	source: string;
	balance?: number;
	isLoading?: boolean;
	decimals?: number;
	showBalance?: boolean;
	onEdit?: () => void;
	type?: 'bsv' | 'mnee';
}) => {
	const handleCopy = () => {
		navigator.clipboard.writeText(address);
		toast.success('Address copied to clipboard');
	};

	return (
		<div className="bg-base-300 rounded-lg p-4 space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className="font-semibold">{title}</span>
					<div className="tooltip" data-tip={tooltip}>
						<FaQuestionCircle className="text-base-content/60" />
					</div>
				</div>
				{onEdit && (
					<button
						className="btn btn-ghost btn-sm"
						onClick={onEdit}
					>
						<FaPencilAlt />
					</button>
				)}
			</div>

			<div className="flex items-center gap-2">
				<div className="font-mono text-sm break-all flex-1">
					{address || 'Not set'}
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={handleCopy}
						className="btn btn-ghost btn-xs btn-square"
						title="Copy address"
					>
						<FaCopy className="w-3 h-3" />
					</button>
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
			</div>

			{showBalance && (
				<div className="flex justify-between items-center text-sm">
					<span className="text-base-content/70">Balance:</span>
					<span className="font-medium">
						{isLoading ? (
							<span className="loading loading-spinner loading-xs"></span>
						) : (
							`${type === 'mnee' ? toToken((balance || 0).toString(), decimals || 8) : (balance || 0)} ${type.toUpperCase()}`
						)}
					</span>
				</div>
			)}

			<div className="text-xs text-base-content/60">
				From {source}
			</div>
		</div>
	);
};

const DashboardSettingsContent = () => {
	const [config, setConfig] = useState<ConfigWithFees | null>(null);
	const [loading, setLoading] = useState(true);
	const [showEditFeesModal, setShowEditFeesModal] = useState(false);
	const [feeAddress, setFeeAddress] = useState("");
	const [isEditing, setIsEditing] = useState(false);
	const { balances, isLoading: balanceLoading } = useBalance();
	const [bsvBalances, setBsvBalances] = useState<{ [key: string]: number }>({});
	const [bsvLoading, setBsvLoading] = useState(false);
	const [tokenDetails, setTokenDetails] = useState<{
		sym: string;
		icon: string;
		amt: number;
	} | null>(null);
	const { statusData } = useSystemStatus();

	// Calculate circulating supply from mints and burns
	const circulatingSupply = useMemo(() => {
		if (!statusData || !config) return 0n;

		// Sum all approved mints
		const totalMints = statusData.mintRequests
			.filter(req => req.status === 'APPROVED')
			.reduce((sum, req) => sum + BigInt(req.amount || '0'), 0n);

		// Sum all approved burns
		const totalBurns = statusData.burnRequests
			.filter(req => req.status === 'APPROVED')
			.reduce((sum, req) => sum + BigInt(req.amount || '0'), 0n);

		return totalMints - totalBurns;
	}, [statusData, config]);

	const fetchBsvBalances = useCallback(async (addresses: string[]) => {
		try {
			setBsvLoading(true);
			const balances: { [key: string]: number } = {};
			
			for (const address of addresses) {
				try {
					const response = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/balance`);
					if (!response.ok) {
						throw new Error('Failed to fetch balance');
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
				const response = await fetch('/api/config');
				const data = await response.json() as Config;
				setConfig({
					...data,
					fees: data.fees as Fee[]
				});
				setFeeAddress(data.feeAddress || "");

				// Fetch BSV balances for minter and cosigner addresses
				const addressesToCheck = [data.mintAddress];
				if (data.fundAddress) {
					addressesToCheck.push(data.fundAddress);
				}
				fetchBsvBalances(addressesToCheck);

				// Fetch token details from the blockchain
				const [txid] = data.tokenId.split('_');
				const indexContext = await ingestTxid(txid);
				const tokenData = indexContext.txos[0].data.bsv21;
				setTokenDetails({
					sym: tokenData.sym,
					icon: tokenData.icon,
					amt: tokenData.amt,
				});
			} catch (error) {
				console.error('Error fetching config:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchConfig();
	}, [fetchBsvBalances]);

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
				throw new Error("Failed to save settings");
			}

			const updatedConfig = await response.json();
			setConfig(updatedConfig);
			setIsEditing(false);
		} catch (error) {
			console.error("Error saving settings:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-screen animate-fade-in">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	if (!config) {
		return (
			<div className="p-4">
				<div className="alert alert-error">
					No configuration found
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 space-y-6 animate-fade-in">
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold">Settings</h1>
				<ThemeSelector />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
				{/* Left Column - Token Details and Fee Structure */}
				<div className="space-y-6">
					{/* Token Details */}
					<div className="card bg-base-200">
						<div className="card-body">
							<h3 className="card-title text-lg mb-4">Token Details</h3>
							<div className="space-y-4">
								{tokenDetails?.icon && (
									<div className="flex justify-center">
										<img 
											src={tokenDetails.icon} 
											alt="Token Icon" 
											className="w-24 h-24 rounded-lg"
											onError={(e) => {
												// Hide the image if it fails to load
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
									</div>
								)}

								<div className="bg-base-300 rounded-lg p-4 space-y-2">
									<div className="flex items-center gap-2">
										<span className="font-semibold">Token ID</span>
										<div className="tooltip" data-tip="Unique identifier for your token on the blockchain">
											<FaQuestionCircle className="text-base-content/60" />
										</div>
									</div>
									<div className="flex items-center gap-2">
										<div className="font-mono text-sm break-all">
											{config.tokenId}
										</div>
										<div className="flex items-center gap-1">
											<button
												onClick={() => {
													navigator.clipboard.writeText(config.tokenId);
													toast.success('Token ID copied to clipboard');
												}}
												className="btn btn-ghost btn-xs btn-square"
											>
												<FaCopy className="w-3 h-3" />
											</button>
											<a
												href={`https://whatsonchain.com/tx/${config.tokenId.split('_')[0]}`}
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

								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="bg-base-300 rounded-lg p-4 space-y-2">
										<div className="flex items-center gap-2">
											<span className="font-semibold">Symbol</span>
											<div className="tooltip" data-tip="The token's ticker symbol">
												<FaQuestionCircle className="text-base-content/60" />
											</div>
										</div>
										<div className="font-mono">
											{tokenDetails?.sym || 'MNEE'}
										</div>
									</div>

									<div className="bg-base-300 rounded-lg p-4 space-y-2">
										<div className="flex items-center gap-2">
											<span className="font-semibold">Decimals</span>
											<div className="tooltip" data-tip="Number of decimal places your token supports">
												<FaQuestionCircle className="text-base-content/60" />
											</div>
										</div>
										<div className="font-mono">
											{config.decimals}
										</div>
									</div>

									<div className="bg-base-300 rounded-lg p-4 space-y-2">
										<div className="flex items-center gap-2">
											<span className="font-semibold">Total Supply</span>
											<div className="tooltip" data-tip="Maximum number of tokens that can exist">
												<FaQuestionCircle className="text-base-content/60" />
											</div>
										</div>
										<div className="font-mono">
											{tokenDetails ? toToken(tokenDetails.amt.toString(), config.decimals) : '0'} MNEE
										</div>
									</div>

									<div className="bg-base-300 rounded-lg p-4 space-y-2">
										<div className="flex items-center gap-2">
											<span className="font-semibold">Circulating Supply</span>
											<div className="tooltip" data-tip="Number of tokens currently in circulation (total mints minus total burns)">
												<FaQuestionCircle className="text-base-content/60" />
											</div>
										</div>
										<div className="font-mono">
											{config ? toToken(circulatingSupply.toString(), config.decimals) : '0'} MNEE
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Fee Structure */}
					<div className="card bg-base-200">
						<div className="card-body">
							<div className="flex justify-between items-center mb-4">
								<h3 className="card-title text-lg">Fee Structure</h3>
								<button
									className="btn btn-primary btn-sm gap-2"
									onClick={() => setShowEditFeesModal(true)}
								>
									<FaPencilAlt /> Edit Fees
								</button>
							</div>
							<div className="overflow-x-auto bg-base-300 rounded-lg">
								<table className="table table-zebra w-full">
									<thead>
										<tr>
											<th>Range</th>
											<th>Fee</th>
										</tr>
									</thead>
									<tbody>
										{config.fees?.map((fee, index) => (
											<tr key={index}>
												<td>
													{toToken(fee.min, config.decimals)} MNEE - {fee.max === Number.MAX_SAFE_INTEGER ? '∞' : `${toToken(fee.max, config.decimals)} MNEE`}
												</td>
												<td>{toToken(fee.fee, config.decimals)} MNEE</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</div>

				{/* Right Column - System Addresses */}
				<div className="space-y-4 w-full lg:w-96">
					<h3 className="text-lg font-bold">System Addresses</h3>
					{/* Fee Address */}
					{isEditing ? (
						<div className="bg-base-300 rounded-lg p-4 space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<span className="font-semibold">Fee Address</span>
									<div className="tooltip" data-tip="Address where transaction fees are collected (MNEE)">
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
									className="btn btn-sm"
									onClick={() => {
										setFeeAddress(config.feeAddress);
										setIsEditing(false);
									}}
								>
									Cancel
								</button>
								<button
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
							address={config.feeAddress}
							tooltip="Address where transaction fees are collected (MNEE)"
							source="Configuration"
							balance={balances[config.feeAddress]}
							isLoading={balanceLoading}
							decimals={config.decimals}
							onEdit={() => setIsEditing(true)}
							type="mnee"
						/>
					)}

					{/* Minter Address */}
					<AddressCard
						title="Minter Address"
						address={config.mintAddress}
						tooltip="Address that will pay for minting/burning tokens (BSV)"
						source="MINT_WIF environment variable"
						balance={bsvBalances[config.mintAddress]}
						isLoading={bsvLoading}
						type="bsv"
					/>

					{/* Burn Address */}
					<AddressCard
						title="Burn Address"
						address={config.burnAddress}
						tooltip="Address to send burned tokens (MNEE)"
						source="BURN_WIF environment variable"
						balance={balances[config.burnAddress]}
						isLoading={balanceLoading}
						decimals={config.decimals}
						type="mnee"
					/>

					{/* Cosigner Address */}
					{config.fundAddress && (
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

			{showEditFeesModal && (
				<EditFeesModal
					fees={config.fees || []}
					onSave={(newFees) => {
						handleSave(newFees);
						setShowEditFeesModal(false);
					}}
					onClose={() => setShowEditFeesModal(false)}
				/>
			)}
		</div>
	);
};

export default DashboardSettingsContent;
