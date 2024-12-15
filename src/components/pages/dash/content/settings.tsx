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
	editIndex?: number;
}

const EditFeesModal = ({ fees, onSave, onClose, editIndex }: EditFeesModalProps) => {
	const [fee, setFee] = useState<Fee>(() => {
		if (editIndex !== undefined && fees[editIndex]) {
			return { ...fees[editIndex] };
		}
		return { min: 0, max: Number.MAX_SAFE_INTEGER, fee: 0 };
	});
	const [config, setConfig] = useState<Config | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Fetch config to get decimals
	useEffect(() => {
		const fetchConfig = async () => {
			const response = await fetch('/api/config');
			const data = await response.json();
			setConfig(data);
		};
		fetchConfig();
	}, []);

	const validateFeeRange = (newFee: Fee) => {
		// Skip validation for the fee being edited
		const otherFees = editIndex !== undefined ? 
			fees.filter((_, i) => i !== editIndex) : 
			fees;

		// Check for overlaps with existing fees
		for (const existingFee of otherFees) {
			if (
				(newFee.min >= existingFee.min && newFee.min < existingFee.max) ||
				(newFee.max > existingFee.min && newFee.max <= existingFee.max) ||
				(newFee.min <= existingFee.min && newFee.max >= existingFee.max)
			) {
				return `Fee range overlaps with existing range ${existingFee.min}-${existingFee.max}`;
			}
		}

		// Validate min/max relationship
		if (newFee.min >= newFee.max) {
			return 'Minimum value must be less than maximum value';
		}

		return null;
	};

	const handleSave = () => {
		const validationError = validateFeeRange(fee);
		if (validationError) {
			setError(validationError);
			return;
		}

		let newFees: Fee[];
		if (editIndex !== undefined) {
			newFees = fees.map((f, i) => i === editIndex ? fee : f);
		} else {
			newFees = [...fees, fee];
		}

		// Sort fees by min value
		newFees.sort((a, b) => a.min - b.min);
		onSave(newFees);
		onClose();
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
				<h3 className="font-bold text-lg mb-4">
					{editIndex !== undefined ? 'Edit Fee' : 'Add Fee'}
				</h3>

				{error && (
					<div className="alert alert-error mb-4">
						<span>{error}</span>
					</div>
				)}
				
				<div className="form-control">
					<div className="grid grid-cols-3 gap-3">
						<div>
							<label className="label">
								<span className="label-text">Min</span>
							</label>
							<label className="input input-bordered flex items-center gap-2">
								<input
									type="text"
									className="grow"
									value={fee.min === 0 ? '' : toToken(fee.min.toString(), config.decimals)}
									placeholder="0"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setFee({ ...fee, min: 0 });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setFee({ ...fee, min: satAmount });
										setError(null);
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
									value={fee.max === Number.MAX_SAFE_INTEGER ? '' : toToken(fee.max.toString(), config.decimals)}
									placeholder="∞"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setFee({ ...fee, max: Number.MAX_SAFE_INTEGER });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setFee({ ...fee, max: satAmount });
										setError(null);
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
									value={fee.fee === 0 ? '' : toToken(fee.fee.toString(), config.decimals)}
									placeholder="0"
									onChange={(e) => {
										const value = e.target.value;
										if (value === '') {
											setFee({ ...fee, fee: 0 });
											return;
										}
										const tokenAmount = Number(value);
										if (isNaN(tokenAmount)) return;
										const satAmount = Math.floor(tokenAmount * Math.pow(10, config.decimals));
										setFee({ ...fee, fee: satAmount });
										setError(null);
									}}
								/>
								<span className="badge badge-ghost">MNEE</span>
							</label>
						</div>
					</div>
				</div>

				<div className="modal-action">
					<button type="button" className="btn" onClick={onClose}>
						Cancel
					</button>
					<button
						type="button"
						className="btn btn-primary"
						onClick={handleSave}
						disabled={fee.min >= fee.max}
					>
						{editIndex !== undefined ? 'Save Changes' : 'Add Fee'}
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
		<div className="space-y-3">
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
				<div className="font-mono text-xs break-all flex-1">
					{address || 'Not set'}
				</div>
				<div className="flex items-center gap-1 shrink-0">
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

const TokenDetailsSection = ({ 
	config, 
	tokenDetails, 
	circulatingSupply 
}: { 
	config: ConfigWithFees; 
	tokenDetails: { sym: string; icon: string; amt: number; } | null;
	circulatingSupply: bigint;
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
						alt="Token Icon" 
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
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="font-mono text-xs">
								{config.tokenId.slice(0, 8)}...{config.tokenId.slice(-8)}
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

					{/* Symbol */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Symbol</span>
							<div className="tooltip tooltip-right" data-tip="The token's ticker symbol">
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
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
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
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
							<span className="font-medium text-sm">Total Supply</span>
							<div className="tooltip tooltip-right" data-tip="Maximum number of tokens that can exist">
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
							</div>
						</div>
						<div className="font-mono text-sm">
							{tokenDetails ? toToken(tokenDetails.amt.toString(), config.decimals) : '0'} MNEE
						</div>
					</div>

					{/* Circulating Supply */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Circulating Supply</span>
							<div className="tooltip tooltip-right" data-tip="Number of tokens currently in circulation (total mints minus total burns)">
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
							</div>
						</div>
						<div className="font-mono text-sm">
							{toToken(circulatingSupply.toString(), config.decimals)} MNEE
						</div>
					</div>

					{/* Icon Field */}
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<span className="font-medium text-sm">Icon Location</span>
							<div className="tooltip tooltip-right" data-tip="The ordfs.network location of the token's icon">
								<FaQuestionCircle className="text-base-content/60 w-4 h-4" />
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div className="font-mono text-xs">
								{tokenDetails?.icon || 'Not set'}
							</div>
							{tokenDetails?.icon && (
								<div className="flex items-center gap-1">
									<button
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
	const [editingFeeIndex, setEditingFeeIndex] = useState<number | undefined>();

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
		<div className="p-4 space-y-8 animate-fade-in">
			<div className="flex justify-between items-center">
				<h1 className="text-2xl font-bold">Settings</h1>
				<ThemeSelector />
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12">
				{/* Left Column - Token Details and Fee Structure */}
				<div className="space-y-12">
					{/* Token Details */}
					{config && (
						<TokenDetailsSection 
							config={config} 
							tokenDetails={tokenDetails}
							circulatingSupply={circulatingSupply}
						/>
					)}

					{/* Fee Structure */}
					<div className="space-y-6">
						<div className="flex justify-between items-center">
							<h3 className="text-lg font-bold">Fee Structure</h3>
							<button
								className="btn btn-primary btn-sm gap-2"
								onClick={() => setShowEditFeesModal(true)}
							>
								<FaPlus /> Add Fee
							</button>
						</div>
						<div className="overflow-x-auto">
							<table className="table w-full">
								<thead>
									<tr>
										<th>Range</th>
										<th>Fee</th>
										<th className="w-20"></th>
									</tr>
								</thead>
								<tbody>
									{config.fees?.map((fee, index) => (
										<tr key={index}>
											<td>
												{toToken(fee.min, config.decimals)} MNEE - {fee.max === Number.MAX_SAFE_INTEGER ? '∞' : `${toToken(fee.max, config.decimals)} MNEE`}
											</td>
											<td>{toToken(fee.fee, config.decimals)} MNEE</td>
											<td>
												<button
													className="btn btn-ghost btn-xs"
													onClick={() => {
														setEditingFeeIndex(index);
														setShowEditFeesModal(true);
													}}
												>
													<FaPencilAlt />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* Right Column - System Addresses */}
				<div className="space-y-8 w-full lg:w-96 bg-base-200 p-4 rounded-lg">
					<h3 className="text-lg font-bold">System Addresses</h3>
					{/* Fee Address */}
					{isEditing ? (
						<div className="space-y-3">
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
						setEditingFeeIndex(undefined);
					}}
					onClose={() => {
						setShowEditFeesModal(false);
						setEditingFeeIndex(undefined);
					}}
					editIndex={editingFeeIndex}
				/>
			)}
		</div>
	);
};

export default DashboardSettingsContent;
