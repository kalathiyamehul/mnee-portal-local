"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import { FaSpinner, FaLock } from 'react-icons/fa';
// import { formatDistanceToNow } from 'date-fns';
import { useSession } from "next-auth/react";
import { FaFire, FaPause, FaPlay, FaSnowflake, FaCoins, FaShieldHalved, FaBan, FaLifeRing } from 'react-icons/fa6';

interface Approval {
	id: string;
	approver: {
		name: string | null;
		email: string;
	};
}

// Action type definitions
type ActionType = 'FREEZE' | 'UNFREEZE' | 'BLACKLIST' | 'UNBLACKLIST' | 'PAUSE' | 'RESUME' | 'MINT';

const REQUEST_TYPES: Record<ActionType, { requiresApproval: boolean }> = {
	FREEZE: { requiresApproval: true },
	UNFREEZE: { requiresApproval: true },
	BLACKLIST: { requiresApproval: false },
	UNBLACKLIST: { requiresApproval: false },
	PAUSE: { requiresApproval: true },
	RESUME: { requiresApproval: true },
	MINT: { requiresApproval: true },
} as const;

interface BaseActivity {
	id: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	createdAt: string;
	requester: {
		name: string | null;
		email: string;
	};
	approvals: Approval[];
	action: ActionType;
}

interface FreezeActivity extends BaseActivity {
	type: 'FREEZE';
	address: string;
}

interface SystemActivity extends BaseActivity {
	type: 'ACTION';
}

interface MintActivity extends BaseActivity {
	type: 'MINT';
	amount: number;
  address: string;
}

interface BlacklistActivity extends BaseActivity {
	type: 'BLACKLIST';
	address: string;
}

type Activity = FreezeActivity | SystemActivity | MintActivity | BlacklistActivity;

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

	const POLL_INTERVAL = 5000; // 5 seconds

	// Filter activities based on showOnlyPending state
	const filteredActivities = useMemo(() => {
		if (!showOnlyPending) return activities;
		return activities.filter(activity => 
			activity.status === 'PENDING' && 
			REQUEST_TYPES[activity.action]?.requiresApproval
		);
	}, [activities, showOnlyPending]);

	// Compute active restrictions from activities
	const activeRestrictions = useMemo(() => {
		const addressMap = new Map<string, AddressStatus>();
		
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

	const fetchStatus = useCallback(async () => {
		try {
			const response = await fetch('/api/status');
			if (response.ok) {
				const data = await response.json();
				setIsPaused(data.isPaused);
				setActivities(data.activities);
			} else {
				console.error('Failed to fetch status:', await response.text());
			}
		} catch (error) {
			console.error('Error fetching status:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let mounted = true;
		let timeoutId: ReturnType<typeof setTimeout>;

		const poll = async () => {
			if (!mounted) return;
			await fetchStatus();
			if (mounted) {
				timeoutId = setTimeout(poll, POLL_INTERVAL);
			}
		};

		// Start polling
		poll();

		// Cleanup
		return () => {
			mounted = false;
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		};
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

		try {
			setMintLoading(true);
			const response = await fetch('/api/mint', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					amount: Number.parseInt(mintAmount),
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

	const handleCancel = async (id: string, type: 'ACTION' | 'FREEZE' | 'MINT' | 'BLACKLIST') => {
		try {
			setLoading(true);
			const response = await fetch('/api/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					type === 'ACTION' 
						? { actionRequestId: id }
						: type === 'FREEZE'
						? { freezeRequestId: id }
						: { mintRequestId: id }
				),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to cancel request');
			}

			await fetchStatus();
		} catch (error) {
			console.error('Error cancelling request:', error);
			alert(error instanceof Error ? error.message : 'Failed to cancel request');
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async (id: string, type: 'ACTION' | 'FREEZE' | 'MINT' | 'BLACKLIST') => {
		try {
			setLoading(true);
			const endpoint = type === 'ACTION' ? '/api/approve' : type === 'FREEZE' ? '/api/approveFreeze' : '/api/approveMint';
			const body = type === 'ACTION' 
				? { actionRequestId: id }
				: type === 'FREEZE'
				? { freezeRequestId: id }
				: { mintRequestId: id };
			
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to approve request');
			}

			await fetchStatus();
		} catch (error) {
			console.error('Error approving request:', error);
			alert(error instanceof Error ? error.message : 'Failed to approve request');
		} finally {
			setLoading(false);
		}
	};

	const canApprove = (activity: Activity) => {
		if (!session?.user?.email) return false;
		if (activity.status !== 'PENDING') return false;
		if (!REQUEST_TYPES[activity.action].requiresApproval) return false;
		if (activity.requester.email === session.user.email) return false;
		return !activity.approvals.some(approval => approval.approver.email === session.user.email);
	};

	const canCancel = (activity: Activity) => {
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

	// Helper function to get activity display text
	const getActivityDisplayText = (activity: Activity): string => {
		const needsRequestSuffix = REQUEST_TYPES[activity.action].requiresApproval;
		return needsRequestSuffix ? `${activity.action} Request` : activity.action;
	};

	// Helper function to get activity icon
	const getActivityIcon = (activity: Activity) => {
		switch (activity.action) {
			case 'PAUSE':
				return <FaPause />;
			case 'RESUME':
				return <FaPlay />;
			case 'MINT':
				return <FaCoins />;
			case 'FREEZE':
				return <FaSnowflake />;
			case 'UNFREEZE':
				return <FaFire />;
			case 'BLACKLIST':
				return <FaBan />;
			case 'UNBLACKLIST':
				return <FaLifeRing />;
			default:
				return null;
		}
	};

	// const renderActivityDetails = (activity: Activity) => {
	// 	const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });
	// 	const approvalCount = activity.approvals.length;
	// 	const isPending = activity.status === 'PENDING';
	// 	const requiresApproval = REQUEST_TYPES[activity.action].requiresApproval;

	// 	return (
	// 		<div key={activity.id} className="card bg-base-200 shadow-xl mb-4">
	// 			<div className="card-body">
	// 				<div className="flex justify-between items-start">
	// 					<div>
	// 						<h3 className="card-title">
	// 							{getActivityIcon(activity)}
	// 							{getActivityDisplayText(activity)}
	// 							{activity.type === 'FREEZE' && activity.address && (
	// 								<div className="badge badge-sm ml-2">
	// 									{activity.address.slice(0, 8)}...{activity.address.slice(-8)}
	// 								</div>
	// 							)}
	// 							{activity.type === 'MINT' && activity.amount > 0 && (
	// 								<div className="badge badge-sm ml-2">
	// 									Amount: {activity.amount}
	// 								</div>
	// 							)}
	// 						</h3>
	// 						<p className="text-sm opacity-70">
	// 							Requested by {activity.requester.name ?? activity.requester.email} {timeAgo}
	// 						</p>
	// 					</div>
	// 					<div className="flex items-center gap-2">
	// 						<div className={`badge ${activity.status === 'APPROVED' ? 'badge-success' : 
	// 							activity.status === 'PENDING' ? 'badge-warning' : 'badge-error'}`}>
	// 							{activity.status}
	// 						</div>
	// 						{!requiresApproval && (
	// 							<div className="badge badge-neutral">No Approval Required</div>
	// 						)}
	// 					</div>
	// 				</div>

	// 				{/* Approvals Section */}
	// 				{requiresApproval && (
	// 					<div className="mt-4">
	// 						<h4 className="font-semibold mb-2">Approvals ({approvalCount}/2)</h4>
	// 						<div className="space-y-2">
	// 							{activity.approvals.map((approval) => (
	// 								<div key={approval.id} className="text-sm opacity-80">
	// 									✓ {approval.approver.name || approval.approver.email}
	// 									{approval.approver.email === activity.requester.email && (
	// 										<span className="text-info ml-2">(requester)</span>
	// 									)}
	// 								</div>
	// 							))}
	// 						</div>
	// 					</div>
	// 				)}

	// 				{/* Action Buttons */}
	// 				{isPending && (
	// 					<div className="card-actions justify-end mt-4">
	// 						{canCancel(activity) && (
	// 							<button
	// 								type="button"
	// 								className="btn btn-error btn-sm"
	// 								onClick={() => handleCancel(activity.id, activity.type)}
	// 								disabled={loading}
	// 							>
	// 								{loading ? <FaSpinner className="animate-spin" /> : 'Cancel Request'}
	// 							</button>
	// 						)}
	// 						{requiresApproval && (
	// 							<button
	// 								type="button"
	// 								className="btn btn-primary btn-sm"
	// 								onClick={() => handleApprove(activity.id, activity.type)}
	// 								disabled={loading || !canApprove(activity)}
	// 								title={
	// 									activity.requester.email === session?.user?.email
	// 										? "Cannot approve your own request"
	// 										: activity.approvals.some(a => a.approver.email === session?.user?.email)
	// 										? "Already approved"
	// 										: "Approve request"
	// 								}
	// 							>
	// 								{loading ? <FaSpinner className="animate-spin" /> : 'Approve'}
	// 							</button>
	// 						)}
	// 					</div>
	// 				)}
	// 			</div>
	// 		</div>
	// 	);
	// };

	// Helper function to find pending request for an address and action
	// const findPendingRequest = (activities: Activity[], address: string, action: ActionType): Activity | undefined => {
	// 	return activities.find(activity => 
	// 		activity.type === 'FREEZE' && 
	// 		activity.address === address && 
	// 		activity.action === action && 
	// 		activity.status === 'PENDING'
	// 	);
	// };

	if (loading && activities.length === 0) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<FaSpinner className="animate-spin text-2xl" />
			</div>
		);
	}

	// Find any pending pause/resume request
	const pendingPauseRequest = activities.find(
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
							<span className="label-text text-sm">Show pending</span>
							<input
								type="checkbox"
								className="toggle toggle-primary toggle-sm sm:toggle-md"
								checked={showOnlyPending}
								onChange={(e) => setShowOnlyPending(e.target.checked)}
							/>
						</label>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => {
								const modal = document.getElementById('freeze_modal') as HTMLDialogElement;
								modal.showModal();
							}}
						>
							<FaShieldHalved className="mr-1" /> 
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

				{/* Activity List */}
				<div className="space-y-3">
					{filteredActivities.map((activity) => (
						<div key={activity.id} className="card bg-base-200 shadow-sm">
							<div className="card-body p-3 sm:p-4">
								<div className="flex flex-wrap justify-between gap-2">
									<div className="flex items-center gap-2 flex-wrap">
										{getActivityIcon(activity)}
										<span className="font-semibold text-sm sm:text-base">
											{getActivityDisplayText(activity)}
										</span>
										{activity.type === 'FREEZE' && activity.address && (
											<div className="badge badge-sm">
												{activity.address.slice(0, 4)}...{activity.address.slice(-4)}
											</div>
										)}
										{activity.type === 'MINT' && activity.amount && (
                      <>
											<div className="badge badge-sm">
												Amount: {activity.amount}
											</div>
                      <div className="badge badge-sm">
                        Minted To: {activity.address}
                      </div>
                      </>
										)}
									</div>
									<div className={`badge badge-sm sm:badge-md ${
										activity.status === 'APPROVED' ? 'badge-success' : 
										activity.status === 'PENDING' ? 'badge-warning' : 'badge-error'
									}`}>
										{activity.status}
									</div>
								</div>
								
								<div className="text-xs sm:text-sm opacity-70 mt-2">
									<p>By: {activity.requester.name || activity.requester.email}</p>
									<p className="mt-1">
										Approvals: {activity.approvals.map(a => a.approver.email).join(', ')}
									</p>
								</div>

								{activity.status === 'PENDING' && (
									<div className="card-actions justify-end mt-2">
										{canCancel(activity) && (
											<button
												type="button"
												className="btn btn-error btn-xs sm:btn-sm"
												onClick={() => handleCancel(activity.id, activity.type)}
												disabled={loading}
											>
												{loading ? <FaSpinner className="animate-spin" /> : 'Cancel'}
											</button>
										)}
										{REQUEST_TYPES[activity.action].requiresApproval && (
											<button
												type="button"
												className="btn btn-primary btn-xs sm:btn-sm"
												onClick={() => handleApprove(activity.id, activity.type)}
												disabled={loading || !canApprove(activity)}
												title={
													activity.requester.email === session?.user?.email
														? "Cannot approve your own request"
														: activity.approvals.some(a => a.approver.email === session?.user?.email)
														? "Already approved"
														: "Approve request"
												}
											>
												{loading ? <FaSpinner className="animate-spin" /> : 'Approve'}
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
