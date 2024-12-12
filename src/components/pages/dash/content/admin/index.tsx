"use client";

import { useCallback, useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { FaSpinner } from 'react-icons/fa6';
import type { Activity, ConfigWithFees, Fee, StatusResponse, AddressStatus } from './types';
import { getActivityIcon, getActivityDisplayText } from './utils';
import { toast } from 'react-hot-toast';
import { FreezeModal } from '../modals/FreezeModal';
import { MintModal } from '../modals/MintModal';
import { BurnModal } from '../modals/BurnModal';
import type { Session } from 'next-auth';
import { ActivityTab } from './ActivityTab';
import { BurnsTab } from './BurnsTab';
import { ActiveRestrictionsTab } from './ActiveRestrictionsTab';
import { SystemStatus } from './SystemStatus';

const POLL_INTERVAL = 5000; // 5 seconds

type TabType = 'activity' | 'restrictions' | 'burns' | 'mints';

interface AdminPageProps {
	defaultTab?: string;
}

export default function AdminPage({ defaultTab = 'activity' }: AdminPageProps) {
	const router = useRouter();
	const { data: session } = useSession() as { data: Session | null };
	const [loading, setLoading] = useState(true);
	const [initialLoading, setInitialLoading] = useState(true);
	const [isPaused, setIsPaused] = useState(false);
	const [showOnlyPending, setShowOnlyPending] = useState(true);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [config, setConfig] = useState<ConfigWithFees | null>(null);
	const [showFreezeModal, setShowFreezeModal] = useState(false);
	const [showMintModal, setShowMintModal] = useState(false);
	const [showBurnModal, setShowBurnModal] = useState(false);
	const [activeTab, setActiveTab] = useState<TabType>(defaultTab as TabType);

	const fetchStatus = useCallback(async () => {
		try {
			const response = await fetch('/api/status?includePending=true');
			const data = await response.json() as StatusResponse;
			
			if (!response.ok) throw new Error(data.error || 'Failed to fetch status');

			const allActivities: Activity[] = [
				...data.freezeRequests.map(req => ({ ...req, type: 'FREEZE' as const })),
				...data.blacklists.map(req => ({ ...req, type: 'BLACKLIST' as const })),
				...data.systemRequests.map(req => ({ ...req, type: 'ACTION' as const })),
				...data.mintRequests.map(req => ({ ...req, type: 'MINT' as const, action: 'MINT' as const })),
				...data.burnRequests.map(req => ({ ...req, type: 'BURN' as const, action: 'BURN' as const })),
			].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			setActivities(allActivities);
			setIsPaused(data.isPaused);
		} catch (error) {
			console.error('Error fetching status:', error);
			toast.error('Failed to fetch status');
		} finally {
			setLoading(false);
			setInitialLoading(false);
		}
	}, []);

	// Set up polling
	useEffect(() => {
		fetchStatus();
		const interval = setInterval(fetchStatus, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	useEffect(() => {
		const fetchConfig = async () => {
			try {
				const response = await fetch('/api/config');
				const data = await response.json();
				if (data) {
					setConfig({
						...data,
						fees: data.fees as Fee[]
					});
				}
			} catch (error) {
				console.error('Error fetching config:', error);
			}
		};

		fetchConfig();
	}, []);

	// Filter activities based on showOnlyPending
	const filteredActivities = activities.filter(activity => 
		!showOnlyPending || activity.status === 'PENDING'
	);

	// Compute active restrictions from activities
	const activeRestrictions = activities.reduce((addressMap, activity) => {
		if ((activity.type === 'FREEZE' || activity.type === 'BLACKLIST') && activity.status === 'APPROVED') {
			const address = activity.address;

			// Get all approved actions for this address
			const addressActions = activities.filter(a => 
				a.address === address && 
				(a.type === 'FREEZE' || a.type === 'BLACKLIST') &&
				a.status === 'APPROVED'
			);

			// Get latest freeze action
			const latestFreezeAction = addressActions
				.filter(a => a.type === 'FREEZE')
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

			// Get latest blacklist action
			const latestBlacklistAction = addressActions
				.filter(a => a.type === 'BLACKLIST')
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

			// Determine current status
			const isFrozen = latestFreezeAction?.action === 'FREEZE';
			const isBlacklisted = latestBlacklistAction?.action === 'BLACKLIST';

			// Only add to map if there are active restrictions
			if (isFrozen || isBlacklisted) {
				addressMap.set(address, {
					address,
					isBlacklisted,
					isFrozen,
					lastUpdate: new Date(Math.max(
						latestFreezeAction ? new Date(latestFreezeAction.createdAt).getTime() : 0,
						latestBlacklistAction ? new Date(latestBlacklistAction.createdAt).getTime() : 0
					)).toISOString()
				});
			} else {
				// If neither frozen nor blacklisted, remove from map
				addressMap.delete(address);
			}
		}
		return addressMap;
	}, new Map<string, AddressStatus & { lastUpdate: string }>());

	// No need for additional filtering since we only add addresses with active restrictions
	const filteredRestrictions = Array.from(activeRestrictions.values());

  console.log({filteredRestrictions})
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
			console.error('Error toggling pause:', error);
			toast.error('Failed to toggle pause');
		} finally {
			setLoading(false);
		}
	};

	const canCancel = useCallback((activity: Activity) => {
		if (!session?.user?.email) return false;
		return activity.status === 'PENDING' && activity.requester.email === session.user.email;
	}, [session]);

	const canApprove = useCallback((activity: Activity) => {
		if (!session?.user?.email) return false;
		if (activity.status !== 'PENDING') return false;
		if (activity.requester.email === session.user.email) return false;
		if (activity.type === 'BLACKLIST') return false;
		return !activity.approvals?.some(approval => approval.approver.email === session.user.email);
	}, [session]);

	const handleCancel = async (id: string, type: Activity['type']) => {
		try {
			setLoading(true);
			const requestType = type.toLowerCase() + 'RequestId';
			await fetch('/api/cancel', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [requestType]: id }),
			});
			await fetchStatus();
			toast.success('Request cancelled');
		} catch (error) {
			console.error('Error cancelling request:', error);
			toast.error('Failed to cancel request');
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async (id: string, type: Activity['type']) => {
		try {
			setLoading(true);
			const endpoint = type === 'ACTION' ? 'approve' :
				type === 'FREEZE' ? 'approveFreeze' :
				type === 'BLACKLIST' ? 'approveBlacklist' :
				type === 'MINT' ? 'approveMint' :
				type === 'BURN' ? 'approveBurn' : null;

			if (!endpoint) throw new Error('Invalid activity type');

			const requestType = type === 'ACTION' ? 'actionRequestId' :
				type === 'FREEZE' ? 'freezeRequestId' :
				type === 'BLACKLIST' ? 'blacklistRequestId' :
				type === 'MINT' ? 'mintRequestId' :
				'burnRequestId';

			const response = await fetch(`/api/${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ [requestType]: id }),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to approve request');
			}

			await fetchStatus();
			toast.success('Request approved');
		} catch (error) {
			console.error('Error approving request:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to approve request');
		} finally {
			setLoading(false);
		}
	};

	const requiresApproval = useCallback((activity: Activity) => {
		return activity.type !== 'BLACKLIST';
	}, []);

	const getApprovalCount = useCallback((activity: Activity) => {
		if (activity.type === 'BLACKLIST') return 0;
		return activity.approvals?.length || 0;
	}, []);

	const handleModalClose = () => {
		setShowFreezeModal(false);
		setShowMintModal(false);
		setShowBurnModal(false);
	};

	const handleModalSuccess = async () => {
		await fetchStatus();
		handleModalClose();
		// Redirect to activity tab after burn request creation
		handleTabChange('activity');
	};

	// Function to show modals
	const showModal = (id: string) => {
		switch (id) {
			case 'freeze_modal':
				setShowFreezeModal(true);
				break;
			case 'mint_modal':
				setShowMintModal(true);
				break;
			case 'burn_modal':
				setShowBurnModal(true);
				break;
		}
	};

	const handleTabChange = (tab: TabType) => {
		setActiveTab(tab);
		router.push(`/dash/admin?tab=${tab}`);
	};

	if (initialLoading) {
		return (
			<div className="flex justify-center items-center h-screen">
				<FaSpinner className="animate-spin text-4xl" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<SystemStatus isPaused={isPaused} onPauseToggle={handlePauseToggle} />
			
			<div className="w-full">
				<div role="tablist" className="tabs tabs-bordered">
					<button
						role="tab"
						className={`tab ${activeTab === 'activity' ? 'tab-active' : ''}`}
						onClick={() => handleTabChange('activity')}
					>
						Activity
					</button>
					<button
						role="tab"
						className={`tab ${activeTab === 'restrictions' ? 'tab-active' : ''}`}
						onClick={() => handleTabChange('restrictions')}
					>
						Restrictions
					</button>
					<button
						role="tab"
						className={`tab ${activeTab === 'mints' ? 'tab-active' : ''}`}
						onClick={() => handleTabChange('mints')}
					>
						Mints
					</button>
					<button
						role="tab"
						className={`tab ${activeTab === 'burns' ? 'tab-active' : ''}`}
						onClick={() => handleTabChange('burns')}
					>
						Burns
					</button>
				</div>

				{activeTab === 'activity' && (
					<ActivityTab
						showOnlyPending={showOnlyPending}
						setShowOnlyPending={setShowOnlyPending}
						filteredActivities={filteredActivities}
						config={config}
						loading={loading}
						canCancel={canCancel}
						canApprove={canApprove}
						handleCancel={handleCancel}
						handleApprove={handleApprove}
						getActivityIcon={getActivityIcon}
						getActivityDisplayText={getActivityDisplayText}
						requiresApproval={requiresApproval}
						getApprovalCount={getApprovalCount}
						showModal={showModal}
					/>
				)}

				{activeTab === 'restrictions' && (
					<ActiveRestrictionsTab
						restrictions={filteredRestrictions}
						loading={loading}
						handleUnblacklist={async (e, address) => {
							e.preventDefault();
							try {
								setLoading(true);
								const response = await fetch('/api/blacklist', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										address,
										action: 'UNBLACKLIST',
									}),
								});

								const data = await response.json();
								if (!response.ok) {
									throw new Error(data.message || data.error || 'Failed to unblacklist address');
								}

								await fetchStatus();
								toast.success('Address unblacklisted');
							} catch (error) {
								console.error('Error unblacklisting address:', error);
								toast.error(error instanceof Error ? error.message : 'Failed to unblacklist address');
							} finally {
								setLoading(false);
							}
						}}
						handleFreezeRequest={async (e, address) => {
							e.preventDefault();
							try {
								setLoading(true);
								const response = await fetch('/api/freeze', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										address,
										action: 'FREEZE',
									}),
								});

								const data = await response.json();
								if (!response.ok) {
									throw new Error(data.message || data.error || 'Failed to freeze address');
								}

								await fetchStatus();
								toast.success('Freeze request created');
							} catch (error) {
								console.error('Error freezing address:', error);
								toast.error(error instanceof Error ? error.message : 'Failed to freeze address');
							} finally {
								setLoading(false);
							}
						}}
						handleUnfreeze={async (address) => {
							try {
								setLoading(true);
								const response = await fetch('/api/freeze', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({
										address,
										action: 'UNFREEZE',
									}),
								});

								const data = await response.json();
								if (!response.ok) {
									throw new Error(data.message || data.error || 'Failed to unfreeze address');
								}

								await fetchStatus();
								toast.success('Unfreeze request created');
							} catch (error) {
								console.error('Error unfreezing address:', error);
								toast.error(error instanceof Error ? error.message : 'Failed to unfreeze address');
							} finally {
								setLoading(false);
							}
						}}
					/>
				)}

				{activeTab === 'burns' && <BurnsTab />}
			</div>

			{showFreezeModal && (
				<FreezeModal
					onClose={handleModalClose}
					onSuccess={handleModalSuccess}
				/>
			)}

			{showMintModal && (
				<MintModal
					onClose={handleModalClose}
					onSuccess={handleModalSuccess}
				/>
			)}

			{showBurnModal && (
				<BurnModal
					onClose={handleModalClose}
					onSuccess={handleModalSuccess}
				/>
			)}
		</div>
	);
} 