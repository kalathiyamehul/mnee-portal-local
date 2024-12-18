"use client";

import { useCallback, useEffect, useState } from 'react';
import { useSession } from "next-auth/react";
import type { Activity, AddressStatus, Fee } from './types';
import { getActivityIcon, getActivityDisplayText } from './utils';
import { toast } from 'react-hot-toast';
import { FreezeModal } from '../modals/FreezeModal';
import { MintModal } from '../modals/MintModal';
import type { Session } from 'next-auth';
import { ActivityTab } from './ActivityTab';
import { BurnsTab } from './BurnsTab';
import { ActiveRestrictionsTab } from './ActiveRestrictionsTab';
import { MintsTab } from './MintsTab';
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow } from 'date-fns';
import { Config } from '@prisma/client';

type TabType = 'activity' | 'restrictions' | 'burns' | 'mints';

interface AdminPageProps {
	defaultTab?: string;
}

export default function AdminPage({ defaultTab = 'activity' }: AdminPageProps) {
	const { data: session } = useSession() as { data: Session | null };
	const [loading, setLoading] = useState(true);
	const [initialLoading, setInitialLoading] = useState(true);
	const [showOnlyPending, setShowOnlyPending] = useState(true);
	const [activities, setActivities] = useState<Activity[]>([]);
	const [config, setConfig] = useState<Config | null>(null);
	const [showFreezeModal, setShowFreezeModal] = useState(false);
	const [showMintModal, setShowMintModal] = useState(false);
	const [activeTab, setActiveTab] = useState<TabType>(defaultTab as TabType);
	const { statusData, fetchStatus } = useSystemStatus();
	const router = useRouter();
	const searchParams = useSearchParams();

	useEffect(() => {
		setActiveTab(defaultTab as TabType);
	}, [defaultTab]);

	const handleTabChange = (tab: TabType) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set('tab', tab);
		router.push(`/dash/admin?${params.toString()}`);
	};

	const showModal = useCallback((id: string) => {
		switch (id) {
			case 'freeze_modal':
				setShowFreezeModal(true);
				break;
			case 'mint_modal':
				setShowMintModal(true);
				break;
		}
	}, []);

	useEffect(() => {
		if (statusData) {
			const allActivities: Activity[] = [
				...statusData.freezeRequests.map(req => ({ ...req, type: 'FREEZE' as const })),
				...statusData.blacklists.map(req => ({ ...req, type: 'BLACKLIST' as const })),
				...statusData.systemRequests.map(req => ({ ...req, type: 'ACTION' as const })),
				...statusData.mintRequests.map(req => ({ ...req, type: 'MINT' as const, action: 'MINT' as const })),
				...statusData.burnRequests.map(req => ({ ...req, type: 'BURN' as const, action: 'BURN' as const })),
			].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

			setActivities(allActivities);
			setLoading(false);
			setInitialLoading(false);
		}
	}, [statusData]);

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

	// Compute active restrictions from activities first
	const activeRestrictions = activities.reduce((addressMap, activity) => {
		if ((activity.type === 'FREEZE' || activity.type === 'BLACKLIST')) {
			const address = activity.address as string;

			// Get all actions for this address
			const addressActions = activities.filter(a => 
				(a.type === 'FREEZE' || a.type === 'BLACKLIST') &&
				a.address === address
			);

			// Get latest freeze action
			const latestFreezeAction = addressActions
				.filter(a => a.type === 'FREEZE')
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

			// Get latest blacklist action
			const latestBlacklistAction = addressActions
				.filter(a => a.type === 'BLACKLIST')
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

			// Get pending actions
			const pendingFreeze = addressActions.find(a => 
				a.type === 'FREEZE' && 
				a.status === 'PENDING'
			);

			// Determine current status
			const isFrozen = latestFreezeAction?.status === 'APPROVED' && latestFreezeAction?.action === 'FREEZE';
			const isBlacklisted = latestBlacklistAction?.status === 'APPROVED' && latestBlacklistAction?.action === 'BLACKLIST';

			// Get the most recent action to determine the requester
			const mostRecentAction = [latestFreezeAction, latestBlacklistAction, pendingFreeze]
				.filter((action): action is (typeof latestFreezeAction | typeof latestBlacklistAction | typeof pendingFreeze) & { createdAt: string } => 
					action !== undefined && action !== null && 'createdAt' in action
				)
				.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

			// Only add to map if there are active restrictions or pending actions
			if (isFrozen || isBlacklisted || pendingFreeze) {
				addressMap.set(address, {
					address,
					isBlacklisted,
					isFrozen,
					hasPendingFreeze: !!pendingFreeze,
					pendingFreezeAction: pendingFreeze?.action === 'FREEZE' || pendingFreeze?.action === 'UNFREEZE' 
						? pendingFreeze.action 
						: undefined,
					requester: mostRecentAction?.requester || pendingFreeze?.requester || latestFreezeAction?.requester || latestBlacklistAction?.requester,
					lastUpdate: mostRecentAction 
						? formatDistanceToNow(new Date(mostRecentAction.createdAt), { addSuffix: true })
						: 'Unknown'
				});
			} else {
				// If neither frozen nor blacklisted and no pending actions, remove from map
				addressMap.delete(address);
			}
		}
		return addressMap;
	}, new Map<string, AddressStatus>());

	// Then filter activities based on showOnlyPending and exclude ones that are pending in active restrictions
	const filteredActivities = activities.filter(activity => {
		// If it's not a freeze or blacklist action, apply normal pending filter
		if (activity.type !== 'FREEZE' && activity.type !== 'BLACKLIST') {
			return !showOnlyPending || activity.status === 'PENDING';
		}

		// For freeze/blacklist actions, check if they're pending and in active restrictions
		const addressStatus = activeRestrictions.get(activity.address as string);
		const isPendingInActiveRestrictions = 
			(activity.type === 'FREEZE' && addressStatus?.hasPendingFreeze);

		// Only show in history if not pending in active restrictions
		return (!showOnlyPending || activity.status === 'PENDING') && !isPendingInActiveRestrictions;
	});

	// Convert active restrictions to array for component
	const filteredRestrictions = Array.from(activeRestrictions.values());

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

	const handleUnblacklist = async (e: React.MouseEvent, address: string) => {
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
	};

	const handleFreezeRequest = async (e: React.MouseEvent<HTMLButtonElement>, address: string) => {
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
				throw new Error(data.error || 'Failed to freeze address');
			}

			await fetchStatus();
			toast.success('Freeze request created');
		} catch (error) {
			console.error('Error freezing address:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to freeze address');
		} finally {
			setLoading(false);
		}
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
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || 'Failed to unfreeze address');
			}

			await fetchStatus();
			toast.success('Unfreeze request created');
		} catch (error) {
			console.error('Error unfreezing address:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to unfreeze address');
		} finally {
			setLoading(false);
		}
	};

	const handleBlacklist = async (e: React.MouseEvent, address: string) => {
		e.preventDefault();
		try {
			setLoading(true);
			const response = await fetch('/api/blacklist', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					address,
					action: 'BLACKLIST',
				}),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.message || data.error || 'Failed to blacklist address');
			}

			await fetchStatus();
			toast.success('Address blacklisted');
		} catch (error) {
			console.error('Error blacklisting address:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to blacklist address');
		} finally {
			setLoading(false);
		}
	};

	const getTabTitle = (tab: TabType): string => {
		switch (tab) {
			case 'activity':
				return 'Admin : Activity';
			case 'restrictions':
				return 'Admin : Restrictions';
			case 'burns':
				return 'Admin : Burns';
			case 'mints':
				return 'Admin : Mints';
			default:
				return 'Admin : Activity';
		}
	};

  if (!session) {
    return <div>Loading...</div>;
  }
  
  
	return (
		<div className="p-4 space-y-4">
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="text-xl sm:text-2xl font-bold">{getTabTitle(activeTab)}</h2>
					<div className="tabs tabs-boxed mt-4">
						<a
							className={`tab ${activeTab === 'activity' ? 'tab-active' : ''}`}
							onClick={() => handleTabChange('activity')}
						>
							Activity
						</a>
						<a
							className={`tab ${activeTab === 'restrictions' ? 'tab-active' : ''}`}
							onClick={() => handleTabChange('restrictions')}
						>
							Restrictions
						</a>
						<a
							className={`tab ${activeTab === 'burns' ? 'tab-active' : ''}`}
							onClick={() => handleTabChange('burns')}
						>
							Burns
						</a>
						<a
							className={`tab ${activeTab === 'mints' ? 'tab-active' : ''}`}
							onClick={() => handleTabChange('mints')}
						>
							Mints
						</a>
					</div>
				</div>

				{initialLoading ? (
					<div className="flex justify-center items-center min-h-[calc(100vh-12rem)] animate-fade-in">
						<div className="loading loading-spinner loading-lg"></div>
					</div>
				) : (
					<div className="animate-fade-in">
						{activeTab === 'activity' && (
							<ActivityTab
								activities={activities}
								showOnlyPending={showOnlyPending}
								onShowOnlyPendingChange={setShowOnlyPending}
								filteredActivities={filteredActivities}
								loading={loading}
								canCancel={canCancel}
								canApprove={canApprove}
								onCancel={handleCancel}
								onApprove={handleApprove}
								requiresApproval={requiresApproval}
								getApprovalCount={getApprovalCount}
								config={config}
								getActivityIcon={getActivityIcon}
								getActivityDisplayText={getActivityDisplayText}
							/>
						)}
						{activeTab === 'restrictions' && (
							<ActiveRestrictionsTab
								restrictions={filteredRestrictions}
								loading={loading}
								handleUnblacklist={handleUnblacklist}
								handleBlacklist={handleBlacklist}
								handleFreezeRequest={handleFreezeRequest}
								handleUnfreeze={handleUnfreeze}
								showModal={showModal}
								activities={activities}
								handleCancel={handleCancel}
								handleApprove={handleApprove}
								session={session}
							/>
						)}
						{activeTab === 'burns' && (
							<BurnsTab />
						)}
						{activeTab === 'mints' && (
							<MintsTab showModal={showModal} />
						)}
					</div>
				)}
			</div>

			{showFreezeModal && (
				<FreezeModal
					onClose={() => setShowFreezeModal(false)}
					onSuccess={fetchStatus}
				/>
			)}
			{showMintModal && (
				<MintModal
					onClose={() => setShowMintModal(false)}
					onSuccess={fetchStatus}
				/>
			)}
		</div>
	);
} 