"use client";

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSession } from "next-auth/react";
import { FaSpinner, FaSnowflake, FaPause, FaPlay, FaCoins, FaBan, FaFire } from 'react-icons/fa6';
import { toToken, toTokenSat } from 'satoshi-token';
import { getConfig } from '@/lib/config';
import { config } from '@prisma/client';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { toast } from 'react-hot-toast';
import { SystemStatus } from './SystemStatus';
import { ActivityList } from './ActivityList';
import { ActiveRestrictions } from './ActiveRestrictions';
import { FreezeModal } from '../modals/FreezeModal';
import { MintModal } from '../modals/MintModal';
import { BurnModal } from '../modals/BurnModal';
import type { Activity, AddressStatus } from './types';
import type { Session } from 'next-auth';

const DashboardAdminContent = () => {
	const { data: session } = useSession() as { data: Session | null };
	const [loading, setLoading] = useState(true);
	const [initialLoading, setInitialLoading] = useState(true);
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
			const res = await fetch('/api/status?includePending=true');
			const data = await res.json();

			if (!res.ok) throw new Error(data.error || 'Failed to fetch status');

			// Process activities
			const allActivities: Activity[] = [
				...data.freezeRequests.map((req: any) => ({ ...req, type: 'FREEZE' })),
				...data.blacklistRequests.map((req: any) => ({ ...req, type: 'BLACKLIST' })),
				...data.systemRequests.map((req: any) => ({ ...req, type: 'ACTION' })),
				...data.mintRequests.map((req: any) => ({ ...req, type: 'MINT', action: 'MINT' })),
				...data.burnRequests.map((req: any) => ({ ...req, type: 'BURN', action: 'BURN' })),
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

	const canApprove = (activity: Activity): boolean => {
		if (!session?.user?.email) return false;
		if (activity.status !== 'PENDING') return false;
		if (!requiresApproval(activity)) return false;
		// The requester's request counts as the first approval
		if (activity.requester.email === session.user.email) return false;
		return !activity.approvals.some(approval => approval.approver.email === session.user.email);
	};

	// Get total approval count
	const getApprovalCount = (activity: Activity): number => {
		if (!requiresApproval(activity)) return 0;
		// Just return the number of approvals, the requester's approval is already included
		return activity.approvals.length;
	};

	// Only show loading indicator on initial load
	if (initialLoading) {
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
			<SystemStatus
				isPaused={isPaused}
				handlePauseToggle={handlePauseToggle}
				pendingPauseRequest={pendingPauseRequest}
			/>

			<ActiveRestrictions
				activeRestrictions={activeRestrictions}
				loading={loading}
				handleUnblacklist={handleUnblacklist}
				handleFreezeRequest={handleFreezeRequest}
				handleUnfreeze={handleUnfreeze}
			/>

			<ActivityList
				showOnlyPending={showOnlyPending}
				setShowOnlyPending={setShowOnlyPending}
				filteredActivities={filteredActivities}
				config={config}
				session={session}
				loading={loading}
				canCancel={canCancel}
				canApprove={canApprove}
				handleCancel={handleCancel}
				handleApprove={handleApprove}
				getActivityIcon={getActivityIcon}
				getActivityDisplayText={getActivityDisplayText}
				requiresApproval={requiresApproval}
				getApprovalCount={getApprovalCount}
			/>

			<FreezeModal
				freezeAddress={freezeAddress}
				setFreezeAddress={setFreezeAddress}
				freezeLoading={freezeLoading}
				blacklistLoading={blacklistLoading}
				handleFreezeRequest={handleFreezeRequest}
				handleBlacklistRequest={handleBlacklistRequest}
			/>

			<MintModal
				mintAddress={mintAddress}
				setMintAddress={setMintAddress}
				mintAmount={mintAmount}
				setMintAmount={setMintAmount}
				mintLoading={mintLoading}
				handleMintRequest={handleMintRequest}
			/>

			<BurnModal
				burnAmount={burnAmount}
				setBurnAmount={setBurnAmount}
				burnLoading={burnLoading}
				handleBurnRequest={handleBurnRequest}
			/>
		</div>
	);
};

export default DashboardAdminContent; 