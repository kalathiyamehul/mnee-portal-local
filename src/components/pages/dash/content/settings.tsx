"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";

interface Fee {
	min: number;
	max: number;
	fee: number;
}

const DashboardSettingsContent: React.FC = () => {
	const [loading, setLoading] = useState(true);
	const [fees, setFees] = useState<Fee[]>([]);
	const [newFee, setNewFee] = useState<Fee>({ min: 0, max: 0, fee: 0 });
	const [feeAddress, setFeeAddress] = useState("");

	useEffect(() => {
		const fetchConfig = async () => {
			try {
				const response = await fetch("/api/config");
				const data = await response.json();
				setFees(data.fees || []);
				setFeeAddress(data.feeAddress || "");
			} catch (error) {
				console.error("Error fetching config:", error);
			} finally {
				setLoading(false);
			}
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

	const handleSave = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/config", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fees,
					feeAddress,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to save settings");
			}
		} catch (error) {
			console.error("Error saving settings:", error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <FaSpinner className="animate-spin mx-auto my-12" />;
	}

	return (
		<div className="p-6">
			<div className="card bg-base-200 p-6">
				{/* Fee Address */}
				<div className="mb-6">
					<h2 className="text-xl font-semibold mb-4">Fee Address</h2>
					<input
						type="text"
						className="input input-bordered w-full"
						value={feeAddress}
						onChange={(e) => setFeeAddress(e.target.value)}
						placeholder="Enter fee address"
					/>
				</div>

				{/* Fee Structure */}
				<div className="mb-6">
					{/* Existing Fees */}
					<div className="mb-4">
						<h3 className="text-lg mb-2">Current Fees</h3>
						{fees.map((fee, index) => (
							<div
								key={`${fee.min}-${fee.max}-${fee.fee}`}
								className="flex items-center mb-2 bg-base-300 p-2 rounded"
							>
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
						<h3 className="text-lg mb-2">Add New Fee</h3>
						<div className="flex gap-4 items-end">
							<div>
								<label className="label">
									Min Amount
									<input
										type="number"
										className="input input-bordered w-32"
										value={newFee.min}
										onChange={(e) =>
											setNewFee({ ...newFee, min: Number(e.target.value) })
										}
									/>
								</label>
							</div>
							<div>
								<label className="label">
									Max Amount
									<input
										type="number"
										className="input input-bordered w-32"
										value={newFee.max}
										onChange={(e) =>
											setNewFee({ ...newFee, max: Number(e.target.value) })
										}
									/>
								</label>
							</div>
							<div>
								<label className="label">
									Fee
									<input
										type="number"
										className="input input-bordered w-32"
										value={newFee.fee}
										onChange={(e) =>
											setNewFee({ ...newFee, fee: Number(e.target.value) })
										}
									/>
								</label>
							</div>
							<button
								type="button"
								onClick={handleAddFee}
								className="btn btn-primary"
								disabled={newFee.min >= newFee.max}
							>
								<FaPlus className="mr-2" /> Add Fee
							</button>
						</div>
					</div>
				</div>

				{/* Save Button */}
				<div className="mt-6">
					<button
						type="button"
						onClick={handleSave}
						className="btn btn-primary"
						disabled={loading}
					>
						{loading ? <FaSpinner className="animate-spin" /> : "Save Changes"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default DashboardSettingsContent;
