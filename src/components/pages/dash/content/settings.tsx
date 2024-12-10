"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaPlus, FaTrash, FaQuestionCircle, FaPencilAlt } from "react-icons/fa";
import { toToken } from 'satoshi-token';
import { Fee, ConfigWithFees } from './admin/types';
import { Config } from '@prisma/client';

interface EditFeesModalProps {
	fees: Fee[];
	onSave: (fees: Fee[]) => void;
	onClose: () => void;
}

const EditFeesModal = ({ fees: initialFees, onSave, onClose }: EditFeesModalProps) => {
	const [fees, setFees] = useState<Fee[]>(initialFees);
	const [newFee, setNewFee] = useState<Fee>({ min: 0, max: 0, fee: 0 });

	const handleAddFee = () => {
		if (newFee.min >= 0 && newFee.max > newFee.min && newFee.fee >= 0) {
			setFees([...fees, newFee]);
			setNewFee({ min: 0, max: 0, fee: 0 });
		}
	};

	const handleRemoveFee = (index: number) => {
		setFees(fees.filter((_, i) => i !== index));
	};

	return (
		<dialog id="edit_fees_modal" className="modal modal-open">
			<div className="modal-box">
				<h3 className="font-bold text-lg mb-4">Edit Fee Structure</h3>
				
				{/* Existing Fees */}
				<div className="mb-4">
					<h4 className="text-md mb-2">Current Fees</h4>
					{fees.map((fee, index) => (
						<div key={index} className="flex items-center mb-2 bg-base-300 p-2 rounded">
							<div className="flex-1">
								<span className="mr-4">Min: {fee.min}</span>
								<span className="mr-4">Max: {fee.max}</span>
								<span>Fee: {fee.fee}</span>
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

				{/* Add New Fee */}
				<div className="form-control">
					<h4 className="text-md mb-2">Add New Fee</h4>
					<div className="grid grid-cols-3 gap-2">
						<div>
							<label className="label">Min Amount</label>
							<input
								type="number"
								className="input input-bordered w-full"
								value={newFee.min}
								onChange={(e) => setNewFee({ ...newFee, min: Number(e.target.value) })}
							/>
						</div>
						<div>
							<label className="label">Max Amount</label>
							<input
								type="number"
								className="input input-bordered w-full"
								value={newFee.max}
								onChange={(e) => setNewFee({ ...newFee, max: Number(e.target.value) })}
							/>
						</div>
						<div>
							<label className="label">Fee</label>
							<input
								type="number"
								className="input input-bordered w-full"
								value={newFee.fee}
								onChange={(e) => setNewFee({ ...newFee, fee: Number(e.target.value) })}
							/>
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

const DashboardSettingsContent = () => {
	const [config, setConfig] = useState<ConfigWithFees | null>(null);
	const [loading, setLoading] = useState(true);
	const [showEditFeesModal, setShowEditFeesModal] = useState(false);
	const [feeAddress, setFeeAddress] = useState("");
	const [isEditing, setIsEditing] = useState(false);

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
			} catch (error) {
				console.error('Error fetching config:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchConfig();
	}, []);

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
			<div className="flex justify-center items-center min-h-[200px]">
				<FaSpinner className="animate-spin text-2xl" />
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
		<div className="p-4 space-y-6">
			<h2 className="text-2xl font-bold mb-6">Settings</h2>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Token Details */}
				<div className="card bg-base-200">
					<div className="card-body">
						<h3 className="card-title text-lg">Token Details</h3>
						<div className="space-y-2">
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold">Token ID:</span>
									<div className="tooltip" data-tip="Unique identifier for your token on the blockchain">
										<FaQuestionCircle className="text-base-content/60" />
									</div>
								</div>
								<div className="font-mono text-sm break-all bg-base-300 p-2 rounded mt-1">
									{config.tokenId}
								</div>
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold">Decimals:</span>
									<div className="tooltip" data-tip="Number of decimal places your token supports">
										<FaQuestionCircle className="text-base-content/60" />
									</div>
								</div>
								<div className="font-mono bg-base-300 p-2 rounded mt-1">
									{config.decimals}
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Addresses */}
				<div className="card bg-base-200">
					<div className="card-body">
						<h3 className="card-title text-lg">Addresses</h3>
						<div className="space-y-2">
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold">Fee Address:</span>
									<div className="tooltip" data-tip="Address where transaction fees are collected">
										<FaQuestionCircle className="text-base-content/60" />
									</div>
								</div>
								{isEditing ? (
									<div className="flex gap-2 mt-1">
										<input
											type="text"
											className="input input-bordered w-full"
											value={feeAddress}
											onChange={(e) => setFeeAddress(e.target.value)}
										/>
										<button
											className="btn btn-primary"
											onClick={() => handleSave()}
											disabled={loading}
										>
											Save
										</button>
										<button
											className="btn"
											onClick={() => {
												setFeeAddress(config.feeAddress);
												setIsEditing(false);
											}}
										>
											Cancel
										</button>
									</div>
								) : (
									<div className="flex items-center gap-2">
										<div className="font-mono text-sm break-all bg-base-300 p-2 rounded mt-1 flex-1">
											{config.feeAddress}
										</div>
										<button
											className="btn btn-ghost btn-sm"
											onClick={() => setIsEditing(true)}
										>
											<FaPencilAlt />
										</button>
									</div>
								)}
							</div>
							<div>
								<div className="flex items-center gap-2">
									<span className="font-semibold">Mint Address:</span>
									<div className="tooltip" data-tip="Address that will pay for minting new tokens">
										<FaQuestionCircle className="text-base-content/60" />
									</div>
								</div>
								<div className="font-mono text-sm break-all bg-base-300 p-2 rounded mt-1">
									{config.mintAddress}
								</div>
								<p className="text-xs text-base-content/70 mt-1">Set from MINT_WIF environment variable</p>
							</div>
							{config.fundAddress && (
								<div>
									<div className="flex items-center gap-2">
										<span className="font-semibold">Fund Address:</span>
										<div className="tooltip" data-tip="Address used for funding token operations">
											<FaQuestionCircle className="text-base-content/60" />
										</div>
									</div>
									<div className="font-mono text-sm break-all bg-base-300 p-2 rounded mt-1">
										{config.fundAddress}
									</div>
								</div>
							)}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Burn Address:</span>
                  <div className="tooltip" data-tip="Address that will pay for burning tokens">
                    <FaQuestionCircle className="text-base-content/60" />
                  </div>
                </div>
                <div className="font-mono text-sm break-all bg-base-300 p-2 rounded mt-1">
                  {config.burnAddress || 'Not set'}
                </div>
                <p className="text-xs text-base-content/70 mt-1">Set from BURN_WIF environment variable</p>
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
								className="btn btn-primary btn-sm"
								onClick={() => setShowEditFeesModal(true)}
							>
								<FaPencilAlt className="mr-2" /> Edit Fees
							</button>
						</div>
						<div className="overflow-x-auto">
							<table className="table table-compact w-full">
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
												{toToken(fee.min, config.decimals)} - {fee.max === Number.MAX_SAFE_INTEGER ? '∞' : toToken(fee.max, config.decimals)}
											</td>
											<td>{toToken(fee.fee, config.decimals)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
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
