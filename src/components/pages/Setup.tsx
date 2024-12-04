// src/components/pages/Setup.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa';
import { fetchTransaction, ingestTxid } from '@/utils/api';

// Default fees that will be used during setup
const DEFAULT_FEES = [
	{ min: 0, max: 10000, fee: 50 },
	{ min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 },
];

// TODO: Allow user to set latest_minter_tx
// latest_minter_tx

const Setup: React.FC = () => {
	const router = useRouter();
	const [loading, setLoading] = useState(true);
	const [hasExistingSetup, setHasExistingSetup] = useState(false);
	const [tokenId, setTokenId] = useState('');
	const [decimals, setDecimals] = useState<number | null>(null);
	const [feeAddress, setFeeAddress] = useState('');
  const [latestMinterTx, setLatestMinterTx] = useState<string | null>(null);
  
  useEffect(() => {
    const fire = async () => {
      const [txid, vout] = tokenId.split('_');
      const data = await ingestTxid(txid);
      const token = data.txos[Number.parseInt(vout)].data.bsv21;
      setDecimals(token.dec);
      const tx = await fetchTransaction(txid)
      // update config and set latest_minter_tx to tx.toHex()
      setLatestMinterTx(tx.toHex());
    }
    if (tokenId) {
      fire();
    }
  }, [tokenId]);
  
	useEffect(() => {
		const checkExistingSetup = async () => {
			try {
				const response = await fetch('/api/config');
				const data = await response.json();
				if (data?.tokenId) {
					setHasExistingSetup(true);
					setTokenId(data.tokenId);
					setDecimals(data.decimals);
					setFeeAddress(data.feeAddress);
					setLatestMinterTx(data.latestMinterTx);
				}
			} catch (error) {
				console.error('Error checking config:', error);
			} finally {
				setLoading(false);
			}
		};

		checkExistingSetup();
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const response = await fetch('/api/config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					tokenId,
					decimals,
					feeAddress,
					fees: DEFAULT_FEES,
					latestMinterTx,
				}),
			});

			if (response.ok) {
				router.push('/dash');
			} else {
				console.error('Failed to save config');
			}
		} catch (error) {
			console.error('Error saving config:', error);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center items-center min-h-screen">
				<FaSpinner className="animate-spin text-4xl" />
			</div>
		);
	}

	if (hasExistingSetup) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<div className="card bg-base-200 p-6 max-w-xl w-full">
					<h1 className="text-2xl font-bold mb-4">Setup Already Complete</h1>
					<div className="mb-4">
						<p className="mb-2">This instance has been configured with:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>Token ID: <code className="text-xs bg-base-300 px-2 py-1 rounded">{tokenId}</code></li>
							<li>Decimals: {decimals}</li>
							<li>Fee Address: <code className="text-sm bg-base-300 px-2 py-1 rounded">{feeAddress}</code></li>
						</ul>
					</div>
					<button
						type="button"
						onClick={() => router.push('/dash')}
						className="btn btn-primary w-full"
					>
						Continue to Dashboard
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center min-h-screen p-4">
			<div className="card bg-base-200 p-6 max-w-md w-full">
				<h1 className="text-2xl font-bold mb-4">Initial Setup</h1>
				<form onSubmit={handleSubmit}>
					{/* Token ID */}
					<div className="mb-4">
						<label htmlFor="tokenId" className="block text-sm font-bold mb-2">
							Token ID
						</label>
						<input
							id="tokenId"
							type="text"
							className="input input-bordered w-full"
							value={tokenId}
							onChange={(e) => setTokenId(e.target.value)}
							required
						/>
					</div>

					{/* Fee Address */}
					<div className="mb-4">
						<label htmlFor="feeAddress" className="block text-sm font-bold mb-2">
							Fee Address
						</label>
						<input
							id="feeAddress"
							type="text"
							className="input input-bordered w-full"
							value={feeAddress}
							onChange={(e) => setFeeAddress(e.target.value)}
							required
						/>
					</div>

					{/* Decimals */}
					<div className="mb-4">
						<label htmlFor="decimals" className="block text-sm font-bold mb-2">
							Decimals
						</label>
						<input
							id="decimals"
							type="number"
							className="input input-bordered w-full"
							value={decimals || ''}
							min={0}
							max={12}
							onChange={(e) => setDecimals(Number(e.target.value))}
							required
						/>
					</div>

					<button
						type="submit"
						className="btn btn-primary w-full"
						disabled={loading}
					>
						{loading ? <FaSpinner className="animate-spin" /> : 'Complete Setup'}
					</button>
				</form>
			</div>
		</div>
	);
};

export default Setup;

