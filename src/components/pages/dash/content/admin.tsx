"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import { FaSpinner, FaLock } from 'react-icons/fa';
// import { formatDistanceToNow } from 'date-fns';
import { useSession } from "next-auth/react";
import { FaFire, FaPause, FaPlay, FaSnowflake, FaCoins, FaBan } from 'react-icons/fa6';
import { toToken, toTokenSat } from 'satoshi-token';
import { getConfig } from '@/lib/config';
import { config } from '@prisma/client';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { toast } from 'react-hot-toast';

// interface Approval {
// 	id: string;
// 	approver: {
// 		name: string | null;
// 		email: string;
// 	};
// }

// // Action type definitions
// type ActionType = 'FREEZE' | 'UNFREEZE' | 'BLACKLIST' | 'UNBLACKLIST' | 'PAUSE' | 'RESUME' | 'MINT' | 'BURN';

interface BaseRequest {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'CANCELLED';
	createdAt: string;
	requester: {
		email: string;
		name: string | null;
	};
	approvals: Array<{
		id: string;
		approver: {
			email: string;
			name: string | null;
		};
	}>;
}

interface FreezeRequest extends BaseRequest {
	action: 'FREEZE' | 'UNFREEZE';
	address: string;
}

interface BlacklistRequest extends BaseRequest {
	action: 'BLACKLIST' | 'UNBLACKLIST';
	address: string;
}

interface SystemRequest extends BaseRequest {
	action: 'PAUSE' | 'RESUME';
}

interface MintRequest extends BaseRequest {
	amount: number;
	address: string;
}

interface BurnRequest extends BaseRequest {
	amount: number;
}

type Activity = (
	| (FreezeRequest & { type: 'FREEZE' })
	| (BlacklistRequest & { type: 'BLACKLIST' })
	| (SystemRequest & { type: 'ACTION' })
	| (MintRequest & { type: 'MINT'; action: 'MINT' })
	| (BurnRequest & { type: 'BURN'; action: 'BURN' })
);

interface AddressStatus {
	address: string;
	isBlacklisted: boolean;
	isFrozen: boolean;
}

const DashboardAdminContent = () => {
	const { data: session } = useSession();
	const [loading, setLoading] = useState(true);
	const [isPaused, setIsPaused] = useState(false);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [freezeAddress, setFreezeAddress] = useState('');
	const [freezeLoading, setFreezeLoading] = useState(false);
	const [blacklistLoading, setBlacklistLoading] = useState(false);
	const [mintAddress, setMintAddress] = useState('');
	const [mintAmount, setMintAmount] = useState('');
	const [mintLoading, setMintLoading] = useState(false);
	const [showOnlyPending, setShowOnlyPending] = useState(true);
	const [burnAmount, setBurnAmount] = useState('');
	const [burnLoading, setBurnLoading] = useState(false);

	const [config, setConfig] = useState<config | null>(null);

	const POLL_INTERVAL = 5000; // 5 seconds

	useEffect(() => {
		const fetchConfig = async () => {
			const config = await getConfig();
      if (config) {
        setConfig(config);
      }
    };
    fetchConfig();
  }, []);


	// Helper function to check if activity requires approval
	const requiresApproval = (activity: Activity): boolean => {
		switch (activity.type) {
			case 'BURN':
			case 'MINT':
			case 'FREEZE':
				return true;
			case 'BLACKLIST':
				return false;
			case 'ACTION':
				return activity.action === 'PAUSE' || activity.action === 'RESUME';
		}
	};
  
	// Filter activities based on showOnlyPending
	const filteredActivities = useMemo(() => {
		if (!showOnlyPending) return activities;
		return activities?.filter(activity => 
			activity.status === 'PENDING' && 
			requiresApproval(activity)
		);
	}, [activities, showOnlyPending]);

	// Compute active restrictions from activities
	const activeRestrictions = useMemo(() => {
		const addressMap = new Map<string, AddressStatus>();
		
    if (!activities) return [];

		// Sort activities by timestamp, newest first
		const sortedActivities = [...activities].sort(
			(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
		);
		
		// First pass: get the latest approved action for each address
		for (const activity of sortedActivities) {
			if ((activity.type === 'FREEZE' || activity.type === 'BLACKLIST') && 
				activity.address && 
				activity.status === 'APPROVED') {
				// Only process if we haven't seen this address yet (since activities are sorted newest first)
				if (!addressMap.has(activity.address)) {
					const status = {
						address: activity.address,
						isBlacklisted: activity.type === 'BLACKLIST' && activity.action === 'BLACKLIST',
						isFrozen: activity.type === 'FREEZE' && activity.action === 'FREEZE'
					};
					addressMap.set(activity.address, status);
				}
			}
		}

		// Convert to array and filter out addresses with no active restrictions
		return Array.from(addressMap.values()).filter(status => status.isBlacklisted || status.isFrozen);
	}, [activities]);

	// Fetch status and activities
	const fetchStatus = useCallback(async () => {
		try {
			setLoading(true);
			const res = await fetch('/api/status?includePending=true');
			const data = await res.json();

			if (!res.ok) throw new Error(data.error || 'Failed to fetch status');

			// Process activities
			const allActivities: Activity[] = [
				...data.freezeRequests.map((req: FreezeRequest) => ({ ...req, type: 'FREEZE' })),
				...data.blacklistRequests.map((req: BlacklistRequest) => ({ ...req, type: 'BLACKLIST' })),
				...data.systemRequests.map((req: SystemRequest) => ({ ...req, type: 'ACTION' })),
				...data.mintRequests.map((req: MintRequest) => ({ ...req, type: 'MINT', action: 'MINT' })),
				...data.burnRequests.map((req: BurnRequest) => ({ ...req, type: 'BURN', action: 'BURN' })),
			].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			setActivities(allActivities);
			setIsPaused(data.isPaused);
		} catch (error) {
			console.error('Error fetching status:', error);
			toast.error('Failed to fetch status');
		} finally {
			setLoading(false);
		}
	}, []);

	// Set up polling
	useEffect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const handlePauseToggle = async () => {
		try {
			setLoading(true);
			const action = isPaused ? 'RESUME' : 'PAUSE';
			await fetch('/api/pause', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action }),
			});
			await fetchStatus();
		} catch (error) {
			console.error('Error toggling pause state:', error);
		} finally {
			setLoading(false);
		}
	};

	// Split into separate handlers for freeze and blacklist
	const handleFreezeRequest = async (e: React.FormEvent<HTMLFormElement | HTMLButtonElement>, address: string = freezeAddress) => {
		e.preventDefault();
		if (!address) return;

		try {
			setFreezeLoading(true);
			const response = await fetch('/api/freeze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					address,
					action: 'FREEZE',
					callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/freezeComplete`
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create freeze request');
			}

			setFreezeAddress('');
			await fetchStatus();
			// Close the modal using the dialog close method
			const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
			modal.close();
		} catch (error) {
			console.error('Error creating freeze request:', error);
			alert(error instanceof Error ? error.message : 'Failed to create freeze request');
		} finally {
			setFreezeLoading(false);
		}
	};

	const handleBlacklistRequest = async (e: React.MouseEvent<HTMLButtonElement | HTMLFormElement>, address: string = freezeAddress) => {
		e.preventDefault();
		if (!address) return;

		try {
			setBlacklistLoading(true);
			const response = await fetch('/api/blacklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					address,
					action: 'BLACKLIST',
					callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/blacklistComplete`
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create blacklist request');
			}

			setFreezeAddress('');
			await fetchStatus();
			// Close the modal using the dialog close method
			const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
			modal.close();
		} catch (error) {
			console.error('Error creating blacklist request:', error);
			alert(error instanceof Error ? error.message : 'Failed to create blacklist request');
		} finally {
			setBlacklistLoading(false);
		}
	};

	const handleMintRequest = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!mintAddress || !mintAmount) return;

    // get the config
    const config = await getConfig();
    if (!config) {
      alert("No config found");
      return;
    }

    
		try {
			setMintLoading(true);
			const response = await fetch('/api/mint', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount: toTokenSat(mintAmount, config.decimals),
					address: mintAddress,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create mint request');
			}

			setMintAddress('');
			setMintAmount('');
			await fetchStatus();
			// Close the modal using the dialog close method
			const modal = document.getElementById('mint_modal') as HTMLDialogElement;
			modal.close();
		} catch (error) {
			console.error('Error creating mint request:', error);
			alert(error instanceof Error ? error.message : 'Failed to create mint request');
		} finally {
			setMintLoading(false);
		}
	};

	const handleCancel = async (id: string, type: Activity['type']) => {
		try {
			setLoading(true);
			const res = await fetch('/api/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					freezeRequestId: type === 'FREEZE' ? id : undefined,
					mintRequestId: type === 'MINT' ? id : undefined,
					burnRequestId: type === 'BURN' ? id : undefined,
					actionRequestId: type === 'ACTION' ? id : undefined,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to cancel request');
			
			toast.success('Request cancelled successfully');
			await fetchStatus();
		} catch (error) {
			console.error('Error cancelling request:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to cancel request');
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async (id: string, type: Activity['type']) => {
		try {
			setLoading(true);
			let endpoint = '';
			switch (type) {
				case 'FREEZE':
					endpoint = '/api/approveFreeze';
					break;
				case 'MINT':
					endpoint = '/api/approveMint';
					break;
				case 'BURN':
					endpoint = '/api/approveBurn';
					break;
				case 'ACTION':
					endpoint = '/api/approve';
					break;
				default:
					throw new Error('Invalid request type');
			}

			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					freezeRequestId: type === 'FREEZE' ? id : undefined,
					mintRequestId: type === 'MINT' ? id : undefined,
					burnRequestId: type === 'BURN' ? id : undefined,
					actionRequestId: type === 'ACTION' ? id : undefined,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to approve request');
			
			toast.success('Request approved successfully');
			await fetchStatus();
		} catch (error) {
			console.error('Error approving request:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to approve request');
		} finally {
			setLoading(false);
		}
	};


	const canCancel = (activity: Activity): boolean => {
		return activity.status === 'PENDING' && activity.requester.email === session?.user?.email;
	};

	const handleUnfreeze = async (address: string) => {
		try {
			setLoading(true);
			const response = await fetch('/api/freeze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					address,
					action: 'UNFREEZE',
					callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/unfreezeComplete`
				}),
			});

			if (!response.ok) {
				throw new Error('Failed to create unfreeze request');
			}

			await fetchStatus();
		} catch (error) {
			console.error('Error creating unfreeze request:', error);
			alert(error instanceof Error ? error.message : 'Failed to create unfreeze request');
		} finally {
			setLoading(false);
		}
	};

	const handleUnblacklist = async (e: React.MouseEvent<HTMLButtonElement>, address: string) => {
		e.preventDefault();

		if (!address) return;
		try {
			setLoading(true);
			const response = await fetch('/api/blacklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					address,
					action: 'UNBLACKLIST',
					callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/unblacklistComplete`
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to unblacklist address');
			}

			await fetchStatus();
		} catch (error) {
			console.error('Error unblacklisting address:', error);
			alert(error instanceof Error ? error.message : 'Failed to unblacklist address');
		} finally {
			setLoading(false);
		}
	};

	// Helper function to get activity icon
	const getActivityIcon = (activity: Activity) => {
		switch (activity.type) {
			case 'FREEZE':
				return <FaSnowflake />;
			case 'BLACKLIST':
				return <FaBan />;
			case 'ACTION':
				return activity.action === 'PAUSE' ? <FaPause /> : <FaPlay />;
			case 'MINT':
				return <FaCoins />;
			case 'BURN':
				return <FaFire className="text-red-500" />;
			default:
				return null;
		}
	};

	// Helper function to get activity display text
	const getActivityDisplayText = (activity: Activity): string => {
		switch (activity.type) {
			case 'BURN':
				return `Burn ${toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)} tokens`;
			case 'MINT':
				return `Mint ${toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)} tokens to ${activity.address}`;
			case 'FREEZE':
				return `${activity.action} ${activity.address}`;
			case 'BLACKLIST':
				return `${activity.action} ${activity.address}`;
			case 'ACTION':
				return activity.action;
		}
	};

	const handleBurnRequest = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!burnAmount) return;

		try {
			setBurnLoading(true);
			const response = await fetch('/api/burn', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount: burnAmount,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to create burn request');
			}

			setBurnAmount('');
			await fetchStatus();
			// Close the modal using the dialog close method
			const modal = document.getElementById('burn_modal') as HTMLDialogElement;
			modal.close();
		} catch (error) {
			console.error('Error creating burn request:', error);
			alert(error instanceof Error ? error.message : 'Failed to create burn request');
		} finally {
			setBurnLoading(false);
		}
	};

	// const handleApproveBurn = async (burnRequestId: string) => {
	// 	try {
	// 		const response = await fetch('/api/approveBurn', {
	// 			method: 'POST',
	// 			headers: { 'Content-Type': 'application/json' },
	// 			body: JSON.stringify({ burnRequestId }),
	// 		});

	// 		if (!response.ok) {
	// 			const error = await response.json();
	// 			throw new Error(error.message || 'Failed to approve burn request');
	// 		}

	// 		await fetchStatus();
	// 	} catch (error) {
	// 		console.error('Error approving burn request:', error);
	// 		alert(error instanceof Error ? error.message : 'Failed to approve burn request');
	// 	}
	// };


	const canApprove = (activity: Activity): boolean => {
		if (!session?.user?.email) return false;
		if (activity.status !== 'PENDING') return false;
		if (!requiresApproval(activity)) return false;
		// The requester's request counts as the first approval
		if (activity.requester.email === session.user.email) return false;
		return !activity.approvals.some(approval => approval.approver.email === session.user.email);
	};

	// Get total approval count (including the requester's implicit approval)
	const getApprovalCount = (activity: Activity): number => {
		if (!requiresApproval(activity)) return 0;
		// Count the requester's request as an approval
		return activity.approvals.length + 1;
	};

	if (loading && activities?.length === 0) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<FaSpinner className="animate-spin text-2xl" />
			</div>
		);
	}

	// Find any pending pause/resume request
	const pendingPauseRequest = activities?.find(
		a => a.type === 'ACTION' && 
		a.status === 'PENDING' && 
		(a.action === 'PAUSE' || a.action === 'RESUME')
	);

	return (
		<div className="p-4 space-y-4">
			<div className="mb-6">
				<h2 className="text-xl sm:text-2xl font-bold mb-2">System Status</h2>
				<div className="flex flex-wrap items-center gap-2">
					<div className={`badge badge-lg ${isPaused ? 'badge-warning' : 'badge-success'}`}>
						{isPaused ? <FaPause className="mr-1" /> : <FaPlay className="mr-1" />}
						<span className="text-sm">{isPaused ? 'Paused' : 'Active'}</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-xs sm:text-sm">Toggle:</span>
						<input
							type="checkbox"
							className="toggle toggle-sm sm:toggle-md"
							checked={isPaused}
							onChange={handlePauseToggle}
							disabled={!!pendingPauseRequest}
						/>
					</div>
					{pendingPauseRequest && (
						<span className="text-warning text-xs sm:text-sm">Pending approval</span>
					)}
				</div>
			</div>

			{/* Active Restrictions Table */}
			<div className="mb-6 overflow-x-auto">
				<h2 className="text-xl sm:text-2xl font-bold mb-2">Active Restrictions</h2>
				<table className="table table-compact sm:table-normal w-full">
					<thead>
						<tr>
							<th className="text-xs sm:text-sm">Address</th>
							<th className="text-xs sm:text-sm">Status</th>
							<th className="text-xs sm:text-sm">Actions</th>
						</tr>
					</thead>
					<tbody>
						{activeRestrictions.map((status) => (
							<tr key={status.address}>
								<td className="font-mono text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">
									{status.address}
								</td>
								<td>
									<div className="flex flex-wrap gap-1 sm:gap-2">
										{status.isBlacklisted ? (
											<span className="badge badge-error badge-sm sm:badge-md gap-1">
												<FaBan className="w-3 h-3" /> Blacklisted
											</span>
										) : (
											<button
												type="button"
												className="btn btn-error btn-xs sm:btn-sm"
												onClick={(e) => handleUnblacklist(e, status.address)}
											>
												<FaBan className="w-3 h-3 mr-1" /> Block
											</button>
										)}
										{status.isFrozen ? (
											<span className="badge badge-error badge-sm sm:badge-md gap-1">
												<FaSnowflake className="w-3 h-3" /> Frozen
											</span>
										) : (
											<button
												type="button"
												className="btn btn-primary btn-xs sm:btn-sm"
												onClick={(e) => handleFreezeRequest(e, status.address)}
											>
												<FaSnowflake className="w-3 h-3 mr-1" /> Freeze
											</button>
										)}
									</div>
								</td>
								<td>
									<div className="flex flex-wrap gap-1 sm:gap-2">
										{status.isBlacklisted && (
											<button
												type="button"
												className="btn btn-outline btn-xs sm:btn-sm"
												onClick={(e) => handleUnblacklist(e, status.address)}
												disabled={loading}
											>
												{loading ? (
													<FaSpinner className="animate-spin w-3 h-3" />
												) : (
													<>
														<FaBan className="w-3 h-3 mr-1" />
														<span className="text-xs sm:text-sm">Unblock</span>
													</>
												)}
											</button>
										)}
										{status.isFrozen && (
											<button
												type="button"
												className="btn btn-outline btn-xs sm:btn-sm"
												onClick={() => handleUnfreeze(status.address)}
												disabled={loading}
											>
												{loading ? (
													<FaSpinner className="animate-spin w-3 h-3" />
												) : (
													<>
														<FaSnowflake className="w-3 h-3 mr-1" />
														<span className="text-xs sm:text-sm">Unfreeze</span>
													</>
												)}
											</button>
										)}
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Activity Section */}
			<div>
				<div className="flex flex-wrap items-center justify-between gap-2 mb-4">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-xl sm:text-2xl font-bold">Activity</h2>
						<label className="label cursor-pointer gap-2 px-2">
							<span className="label-text text-sm">Pending Only</span>
							<input
								type="checkbox"
								className="toggle toggle-primary toggle-sm sm:toggle-md"
								checked={showOnlyPending}
								onChange={(e) => setShowOnlyPending(e.target.checked)}
							/>
						</label>
					</div>
					<div className="flex gap-2 mb-4">
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => {
								const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
									modal.showModal();
							}}
						>
							<FaSnowflake className="mr-1" /> 
							<span className="text-sm">Restrict</span>
						</button>
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => {
								const modal = document.getElementById('mint_modal') as HTMLDialogElement;
								modal.showModal();
							}}
						>
							<FaCoins className="mr-1" /> 
							<span className="text-sm">Mint</span>
						</button>
						<button
							className="btn btn-primary"
							onClick={() => {
								const modal = document.getElementById('burn_modal') as HTMLDialogElement;
								modal.showModal();
							}}
						>
							<FaFire className="mr-2" /> Burn
						</button>
					</div>
				</div>

				{/* Freeze/Blacklist Modal */}
				<dialog id="freeze_modal" className="modal">
					<div className="modal-box">
						<h3 className="font-bold text-lg mb-2">Restrict Address</h3>
						<div className="mb-6 space-y-2 text-sm opacity-70">
							<p><FaSnowflake className="inline mr-2" /> Freeze: Prevents an address from sending funds</p>
							<p><FaLock className="inline mr-2" /> Blacklist: Prevents an address from receiving funds</p>
						</div>
						<form onSubmit={() => {}}>
							<div className="form-control">
								<label className="label" htmlFor="freezeAddress">
									<span className="label-text">Bitcoin Address</span>
								</label>
								<input
									type="text"
									id="freezeAddress"
									className="input input-bordered w-full"
									value={freezeAddress}
									onChange={(e) => setFreezeAddress(e.target.value)}
									placeholder="Enter Bitcoin SV Address"
									required
								/>
							</div>
							<div className="modal-action">
								<button
									type="button"
									className="btn"
									onClick={() => {
										const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
										modal.close();
									}}
								>
									Cancel
								</button>
								<button
									type="button"
									className="btn btn-error"
									onClick={handleBlacklistRequest}
									disabled={blacklistLoading || !freezeAddress}
								>
									{blacklistLoading ? <FaSpinner className="animate-spin" /> : 'Blacklist'}
								</button>
								<button
									type="button"
									className="btn btn-primary"
									onClick={handleFreezeRequest}
									disabled={freezeLoading || !freezeAddress}
								>
									{freezeLoading ? <FaSpinner className="animate-spin" /> : 'Freeze'}
								</button>
							</div>
						</form>
					</div>
				</dialog>

				{/* Mint Request Modal */}
				<dialog id="mint_modal" className="modal">
					<div className="modal-box">
						<h3 className="font-bold text-lg mb-4">Create Mint Request</h3>
						<form onSubmit={handleMintRequest}>
							<div className="form-control">
								<label className="label" htmlFor="mintAddress">
									<span className="label-text">Receiver Address</span>
								</label>
								<input
									type="text"
									id="mintAddress"
									className="input input-bordered w-full mb-4"
									value={mintAddress}
									onChange={(e) => setMintAddress(e.target.value)}
									placeholder="Enter Bitcoin SV Address"
									required
								/>
								<label className="label" htmlFor="mintAmount">
									<span className="label-text">Amount</span>
								</label>
								<input
									type="number"
									id="mintAmount"
									className="input input-bordered w-full"
									value={mintAmount}
									onChange={(e) => setMintAmount(e.target.value)}
									placeholder="Enter amount to mint"
									min="1"
									required
								/>
							</div>
							<div className="modal-action">
								<button
									type="button"
									className="btn"
									onClick={() => {
										const modal = document.getElementById('mint_modal') as HTMLDialogElement;
										modal.close();
									}}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="btn btn-primary"
									disabled={mintLoading || !mintAddress || !mintAmount}
								>
									{mintLoading ? <FaSpinner className="animate-spin" /> : 'Submit'}
								</button>
							</div>
						</form>
					</div>
				</dialog>

				{/* Burn Modal */}
				<dialog id="burn_modal" className="modal">
					<div className="modal-box">
						<h3 className="font-bold text-lg mb-4">Burn Tokens</h3>
						<form onSubmit={handleBurnRequest}>
							<div className="form-control">
								<label className="label">
									<span className="label-text">Amount</span>
								</label>
								<input
									type="number"
									className="input input-bordered"
									value={burnAmount}
									onChange={(e) => setBurnAmount(e.target.value)}
									required
								/>
							</div>
							<div className="modal-action">
								<button type="button" className="btn" onClick={() => {
									const modal = document.getElementById('burn_modal') as HTMLDialogElement;
									modal.close();
								}}>
									Cancel
								</button>
								<button type="submit" className={`btn btn-primary ${burnLoading ? 'loading' : ''}`}>
									{burnLoading ? 'Creating...' : 'Create Burn Request'}
								</button>
							</div>
						</form>
					</div>
				</dialog>

				{/* Activity List */}
				<div className="space-y-3">
					{filteredActivities?.map((activity) => (
						<div key={activity.id} className="card bg-base-200 shadow-sm">
							<div className="card-body p-3 sm:p-4">
								<div className="flex flex-wrap justify-between gap-2">
									<div className="flex items-center gap-2">
										{getActivityIcon(activity)}
										<span>{getActivityDisplayText(activity)}</span>
										{activity.type === 'FREEZE' && activity.address && (
											<div className="badge badge-sm">
												{activity.address.slice(0, 8)}...{activity.address.slice(-8)}
											</div>
										)}
										{activity.type === 'MINT' && (
											<div className="badge badge-sm">
												Amount: {toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)}
											</div>
										)}
										{activity.type === 'BURN' && (
											<div className="badge badge-sm">
												Amount: {toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)}
											</div>
										)}
									</div>
									<div className="flex items-center gap-2">
										<div className={`badge badge-sm ${
											activity.status === 'APPROVED' ? 'badge-success' :
											activity.status === 'PENDING' ? 'badge-warning' :
											'badge-error'
										}`}>
											{activity.status}
										</div>
										{!requiresApproval(activity) && (
											<div className="badge badge-sm badge-neutral">No Approval Required</div>
										)}
									</div>
								</div>

								{/* Approvals Section */}
								{requiresApproval(activity) && (
									<div className="mt-2">
										<div className="text-sm opacity-70">
											Approvals ({getApprovalCount(activity)}/2)
										</div>
										<div className="space-y-1">
											<div className="text-sm">
												✓ {activity.requester.name || activity.requester.email} (Requester)
											</div>
											{activity.approvals.map((approval) => (
												<div key={approval.id} className="text-sm">
													✓ {approval.approver.name || approval.approver.email}
												</div>
											))}
										</div>
									</div>
								)}

								{/* Action Buttons */}
								{activity.status === 'PENDING' && (
									<div className="card-actions justify-end mt-3">
										{canCancel(activity) && (
											<button
												className="btn btn-error btn-sm"
												onClick={() => handleCancel(activity.id, activity.type)}
												disabled={loading}
											>
												Cancel
											</button>
										)}
										{canApprove(activity) && (
											<button
												className="btn btn-primary btn-sm"
												onClick={() => handleApprove(activity.id, activity.type)}
												disabled={loading}
												title={
													activity.requester.email === session?.user?.email
														? "Cannot approve your own request"
														: activity.approvals.some(a => a.approver.email === session?.user?.email)
														? "Already approved"
														: "Approve request"
												}
											>
												Approve
											</button>
										)}
									</div>
								)}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export default DashboardAdminContent;
