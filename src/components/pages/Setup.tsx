// src/components/pages/Setup.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { FaPlus, FaTrash } from "react-icons/fa";
import type { BSV21 } from "@/types/bsv21";

interface FeeConfig {
	min: number;
	max: number;
	fee: number;
}

const Setup = () => {
	const [tokenId, setTokenId] = useState("");
	const [feeAddress, setFeeAddress] = useState("");
	const [fees, setFees] = useState<FeeConfig[]>([]);
	const [decimals, setDecimals] = useState<number | null>(null);
	const [newFee, setNewFee] = useState<FeeConfig>({ min: 0, max: 0, fee: 0 });
	const [fetchingTokenDetails, setFetchingTokenDetails] = useState(false);
	const [tokenError, setTokenError] = useState("");
	const router = useRouter();

	// Fetch existing configuration on component mount
	useEffect(() => {
		const fetchConfig = async () => {
			try {
				const res = await fetch("/api/config");

				if (res.ok) {
					const config = await res.json();
          if (config) {
            setTokenId(config.tokenId || "");
            setFeeAddress(config.feeAddress || "");
            setFees(config.fees || defaultFees);
            setDecimals(config.decimals || null);
					} else {
						setFees(defaultFees);
					}
				} else {
					// Set default fees if no config exists
					setFees(defaultFees);
				}
			} catch (error) {
				console.error("Error fetching configuration:", error);
				setFees(defaultFees);
			}
		};
		fetchConfig();
	}, []);

	// Function to validate tokenId
	const validateTokenId = useCallback((tokenId: string) => {
		const pattern = /^[a-fA-F0-9]{64}_\d+$/;
		return pattern.test(tokenId);
	}, []);

	// Function to fetch token details
	const getTokenDetails = useCallback(async (tokenId: string) => {
		setFetchingTokenDetails(true);
		try {
			const res = await fetch(`/api/token/${tokenId}`);
			if (res.ok) {
				const tokenDetails: BSV21 = await res.json();
				const tokenDecimals = tokenDetails.dec;
				setDecimals(tokenDecimals);
				setTokenError("");
			} else {
				setTokenError("Invalid token ID or token not found.");
				setDecimals(null);
			}
		} catch (error) {
			console.error("Error fetching token details:", error);
			setTokenError("Error fetching token details.");
			setDecimals(null);
		}
		setFetchingTokenDetails(false);
	}, []);

	// Watch for changes to tokenId and validate
	useEffect(() => {
		if (tokenId && validateTokenId(tokenId)) {
			getTokenDetails(tokenId);
		} else if (tokenId) {
			setTokenError("Invalid token ID format.");
			setDecimals(null);
		} else {
			setTokenError("");
			setDecimals(null);
		}
	}, [tokenId, getTokenDetails, validateTokenId]);

	// Handler to add a new fee configuration
	const handleAddFee = () => {
		if (newFee.min >= 0 && newFee.max >= newFee.min && newFee.fee >= 0) {
			const updatedFees = [...fees, newFee];
			setFees(updatedFees);
			setNewFee({ min: 0, max: 0, fee: 0 });
			saveConfig(updatedFees);
		} else {
			alert("Please enter valid fee configuration.");
		}
	};

	// Handler to delete a fee configuration
	const handleDeleteFee = (index: number) => {
		const updatedFees = fees.filter((_, i) => i !== index);
		setFees(updatedFees);
		saveConfig(updatedFees);
	};

	// Function to save the Config to the database
	const saveConfig = async (updatedFees: FeeConfig[] = fees) => {
		const res = await fetch("/api/config", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				tokenId,
				feeAddress,
				fees: updatedFees,
				decimals,
			}),
		});

		if (!res.ok) {
			console.error("Error saving configuration.");
		}
	};

	// Handle form submission
	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (tokenError) {
			alert("Please resolve token ID errors before submitting.");
			return;
		}
		await saveConfig();
		alert("Configuration saved!");
		router.push("/dash");
	};

	return (
		<div className="flex flex-col items-center justify-center min-h-screen">
			<h1 className="text-2xl mb-4">Setup</h1>
			<form onSubmit={handleSubmit} className="w-full max-w-sm">
				{/* Token ID */}
				<div className="mb-4">
					<label htmlFor="tokenId" className="block text-sm font-bold mb-2">
						Token ID
					</label>
					<input
						type="text"
						id="tokenId"
						value={tokenId}
						onChange={(e) => setTokenId(e.target.value)}
						className="input input-bordered w-full"
						required
					/>
					{fetchingTokenDetails && (
						<p className="text-sm text-gray-500">Validating token ID...</p>
					)}
					{tokenError && <p className="text-sm text-red-500">{tokenError}</p>}
				</div>
				{/* Decimals (Display Only) */}
				{decimals !== null && (
					<div className="mb-4">
						<label className="block text-sm font-bold mb-2">
							Decimals: {decimals}
						</label>
					</div>
				)}
				{/* Fee Address */}
				<div className="mb-4">
					<label htmlFor="feeAddress" className="block text-sm font-bold mb-2">
						Fee Address
					</label>
					<input
						type="text"
						id="feeAddress"
						value={feeAddress}
						onChange={(e) => setFeeAddress(e.target.value)}
						className="input input-bordered w-full"
						required
					/>
				</div>
				{/* Fees */}
				<div className="mb-4">
					<label className="block text-sm font-bold mb-2">Fees</label>
					{/* List existing fees */}
					{fees.map((fee, index) => (
						<div key={index} className="flex items-center mb-2">
							<div className="flex-1">
								Min: {fee.min}, Max: {fee.max}, Fee: {fee.fee}
							</div>
							<button
								type="button"
								className="btn btn-error btn-xs ml-2"
								onClick={() => handleDeleteFee(index)}
							>
								<FaTrash />
							</button>
						</div>
					))}
					{/* Add new fee */}
					<div className="flex items-center mt-2">
						<input
							type="number"
							placeholder="Min"
							value={newFee.min}
							onChange={(e) =>
								setNewFee({ ...newFee, min: Number(e.target.value) })
							}
							className="input input-bordered w-24 mr-2"
						/>
						<input
							type="number"
							placeholder="Max"
							value={newFee.max}
							onChange={(e) =>
								setNewFee({ ...newFee, max: Number(e.target.value) })
							}
							className="input input-bordered w-24 mr-2"
						/>
						<input
							type="number"
							placeholder="Fee"
							value={newFee.fee}
							onChange={(e) =>
								setNewFee({ ...newFee, fee: Number(e.target.value) })
							}
							className="input input-bordered w-24 mr-2"
						/>
						<button
							type="button"
							className="btn btn-primary btn-xs"
							onClick={handleAddFee}
						>
							<FaPlus />
						</button>
					</div>
				</div>
				{/* Submit Button */}
				<button type="submit" className="btn btn-primary w-full mb-2">
					Save Configuration
				</button>
			</form>
		</div>
	);
};

export default Setup;

const defaultFees: FeeConfig[] = [
	{ min: 0, max: 10000, fee: 50 },
	{ min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 },
];
