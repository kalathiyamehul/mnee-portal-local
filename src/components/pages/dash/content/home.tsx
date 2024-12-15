"use client";

import { FaBitcoinSign, FaUsers, FaCircleExclamation, FaMoneyBillTransfer, FaArrowRight } from "react-icons/fa6";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MintTable } from "./admin/MintTable";
import { BurnTable } from "./admin/BurnTable";
import { toast } from 'react-hot-toast';
import type { Activity, BurnUtxo } from './admin/types';
import { TokenActivityChart } from "@/components/charts/TokenActivityChart";
import { ActivityList } from './admin/ActivityList';
import { getActivityIcon } from "./admin/utils";
import { useSession } from "next-auth/react";
import { Config } from "@prisma/client";

// Utility functions
const getActivityDisplayText = (activity: Activity) => {
	switch (activity.type) {
		case 'MINT':
			return `Mint ${activity.amount} MNEE`;
		case 'BURN':
			return `Burn ${activity.amount} MNEE`;
		case 'FREEZE':
			return `Freeze Address ${activity.address}`;
		case 'BLACKLIST':
			return `Blacklist Address ${activity.address}`;
		case 'ACTION':
			return activity.action || 'Unknown Action';
		default:
			return 'Unknown Activity';
	}
};

const requiresApproval = (activity: Activity) => {
	return activity.type !== 'BLACKLIST';
};

const getApprovalCount = (activity: Activity) => {
	if (activity.type === 'BLACKLIST') return 0;
	return activity.approvals?.length || 0;
};

type ChartType = 'volume' | 'mints' | 'burns' | 'customers' | 'restrictions';

type DashboardMetrics = {
	totalCustomers: number;
	totalMintVolume: number;
	pendingMints: number;
	recentMints: Activity[];
	activeBlacklists: number;
	pendingBurns: number;
	recentBurns: Array<{
		id: string;
		amount: number;
		status: string;
		createdAt: string;
		outpoint: string;
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
	}>;
};

interface DashboardHomeContentProps {
	initialConfig: Config;
}

const DashboardHomeContent = ({ initialConfig }: DashboardHomeContentProps) => {
	const { data: session } = useSession();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
	const [loading, setLoading] = useState(false);

	// Default to 'volume' if no chart is selected
	const selectedChart = (searchParams.get('chart') || 'volume') as ChartType;

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
			fetchMetrics();
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

			fetchMetrics();
			toast.success('Request approved');
		} catch (error) {
			console.error('Error approving request:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to approve request');
		} finally {
			setLoading(false);
		}
	};

	const fetchMetrics = () => {
		fetch("/api/dashboard")
			.then((response) => response.json())
			.then((data) => setMetrics(data))
			.catch((error) => console.error("Failed to fetch dashboard metrics:", error));
	};

	useEffect(() => {
		fetchMetrics();
	}, []);

	if (!metrics) {
		return (
			<div className="flex justify-center items-center min-h-screen animate-fade-in">
				<div className="loading loading-spinner loading-lg"></div>
			</div>
		);
	}

	// Format burns for the BurnTable component
	const formattedBurns: BurnUtxo[] = (metrics.recentBurns || []).map(burn => {
		const [txid, vout] = (burn.outpoint || '').split('_');
		if (!txid || !vout) return null;

		return {
			txid,
			vout: parseInt(vout),
			height: 0,
			data: {
				bsv21: {
					amt: burn.amount
				}
			},
			burnRequest: {
				id: burn.id,
				status: burn.status,
				createdAt: burn.createdAt,
				amount: burn.amount.toString(),
				requester: burn.requester,
				outpoint: burn.outpoint,
				updatedAt: burn.createdAt,
				approvals: burn.approvals
			},
			idx: 0,
			script: '',
			outpoint: burn.outpoint,
			satoshis: 0,
			owners: []
		};
	}).filter(Boolean) as unknown as BurnUtxo[];

	const getStatCardClass = (chartType: ChartType) => {
		const baseClass = "stat hover:bg-base-200 transition-colors cursor-pointer bg-base-200 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:opacity-0 after:transition-opacity";
		return selectedChart === chartType 
			? `${baseClass} bg-base-300 after:opacity-100 after:bg-accent` 
			: baseClass;
	};

	const getChartType = (selected: ChartType) => {
		// Map the selected type to the actual chart type
		switch (selected) {
			case 'mints':
			case 'burns':
				return 'count';
			default:
				return selected;
		}
	};

	const handleChartSelect = (chartType: ChartType) => {
		const params = new URLSearchParams(searchParams);
		if (selectedChart === chartType) {
			// Instead of removing the param, set it back to volume
			params.set('chart', 'volume');
		} else {
			params.set('chart', chartType);
		}
		router.push(`?${params.toString()}`);
	};

	const mappedBurns = metrics?.recentBurns.map(burn => ({
		...burn,
		type: 'BURN' as const,
		action: 'BURN' as const,
		address: burn.outpoint?.split('_')[0] || '',
		amount: burn.amount.toString(),
		updatedAt: burn.createdAt,
		requestedBy: burn.requester.email,
		requiresApproval: true,
	} as Activity)) || [];

	const pendingActivities = metrics?.recentMints
		.concat(mappedBurns)
		.filter(activity => activity.status === 'PENDING')
		.slice(0, 5) || [];

	return (
		<div className="p-4 space-y-8 animate-fade-in">
			<div className="stats shadow w-full">
				<div 
					className={getStatCardClass('customers')}
					onClick={() => handleChartSelect('customers')}
				>
					<div className="stat-figure text-base-content/70">
						<FaUsers className="w-8 h-8" />
					</div>
					<div className="stat-title text-base-content/70">Total Customers</div>
					<div className="stat-value text-primary">
						{metrics.totalCustomers}
					</div>
					<div className="stat-desc text-base-content/60">Active platform users</div>
				</div>

				<div 
					className={getStatCardClass('volume')}
					onClick={() => handleChartSelect('volume')}
				>
					<div className="stat-figure text-base-content/70">
						<FaBitcoinSign className="w-8 h-8" />
					</div>
					<div className="stat-title text-base-content/70">24h Mint Volume</div>
					<div className="stat-value text-primary">
						{metrics.totalMintVolume.toLocaleString()}
					</div>
					<div className="stat-desc text-base-content/60">MNEE</div>
				</div>

				<div 
					className={getStatCardClass('mints')}
					onClick={() => handleChartSelect('mints')}
				>
					<div className="stat-figure text-base-content/70">
						<FaMoneyBillTransfer className="w-8 h-8" />
					</div>
					<div className="stat-title text-base-content/70">Pending Mints</div>
					<div className="stat-value text-primary">
						{metrics.pendingMints}
					</div>
					<div className="stat-desc text-base-content/60">Awaiting approval</div>
				</div>

				<div 
					className={getStatCardClass('burns')}
					onClick={() => handleChartSelect('burns')}
				>
					<div className="stat-figure text-base-content/70">
						<FaBitcoinSign className="w-8 h-8" />
					</div>
					<div className="stat-title text-base-content/70">Pending Burns</div>
					<div className="stat-value text-primary">
						{metrics.pendingBurns}
					</div>
					<div className="stat-desc text-base-content/60">Awaiting approval</div>
				</div>

				<div 
					className={getStatCardClass('restrictions')}
					onClick={() => handleChartSelect('restrictions')}
				>
					<div className="stat-figure text-base-content/70">
						<FaCircleExclamation className="w-8 h-8" />
					</div>
					<div className="stat-title text-base-content/70">Active Restrictions</div>
					<div className="stat-value text-primary">
						{metrics.activeBlacklists}
					</div>
					<div className="stat-desc text-base-content/60">Blacklisted or frozen addresses</div>
				</div>
			</div>

			<div className="w-full">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-semibold">
						{selectedChart === 'volume' && 'Token Volume History'}
						{selectedChart === 'mints' && 'Mint Transaction History'}
						{selectedChart === 'burns' && 'Burn Transaction History'}
						{selectedChart === 'customers' && 'Customer Growth'}
						{selectedChart === 'restrictions' && 'Restrictions History'}
					</h2>
					{selectedChart === 'volume' && (
						<button
							onClick={() => router.push('/dash/admin?tab=mints')}
							className="btn btn-ghost btn-sm gap-2"
						>
							View Mints <FaArrowRight className="w-3 h-3" />
						</button>
					)}
					{selectedChart === 'mints' && (
						<button
							onClick={() => router.push('/dash/admin?tab=mints')}
							className="btn btn-ghost btn-sm gap-2"
						>
							View Mints <FaArrowRight className="w-3 h-3" />
						</button>
					)}
					{selectedChart === 'burns' && (
						<button
							onClick={() => router.push('/dash/admin?tab=burns')}
							className="btn btn-ghost btn-sm gap-2"
						>
							View Burns <FaArrowRight className="w-3 h-3" />
						</button>
					)}
					{selectedChart === 'customers' && (
						<button
							onClick={() => router.push('/dash/customers')}
							className="btn btn-ghost btn-sm gap-2"
						>
							View Customers <FaArrowRight className="w-3 h-3" />
						</button>
					)}
					{selectedChart === 'restrictions' && (
						<button
							onClick={() => router.push('/dash/admin?tab=restrictions')}
							className="btn btn-ghost btn-sm gap-2"
						>
							View Restrictions <FaArrowRight className="w-3 h-3" />
						</button>
					)}
				</div>
				<TokenActivityChart 
					type={getChartType(selectedChart)}
					highlight={selectedChart === 'burns' ? 'burns' : 'mints'}
					height={350} 
				/>
			</div>

			<div className="w-full">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-semibold">Pending Activities</h2>
					<button
						onClick={() => router.push('/dash/admin?tab=activity')}
						className="btn btn-ghost btn-sm gap-2"
					>
						View Activity <FaArrowRight className="w-3 h-3" />
					</button>
				</div>
				<ActivityList
					showOnlyPending={true}
					setShowOnlyPending={() => {}}
					filteredActivities={pendingActivities}
					config={initialConfig}
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
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
				<div className="w-full">
					<MintTable 
						title="Recent Mints"
						mints={metrics.recentMints} 
						limit={5} 
						showViewAll={true} 
						onUpdate={fetchMetrics}
						mode="all"
					/>
				</div>

				<div className="w-full">
					<BurnTable 
						title="Recent Burns"
						burns={formattedBurns}
						decimals={initialConfig.decimals}
						onCopyTxid={(txid) => {
							navigator.clipboard.writeText(txid);
							toast.success('Transaction ID copied to clipboard');
							}}
						alwaysShow={true}
						showViewAll={true}
					/>
				</div>
			</div>
		</div>
	);
};

export default DashboardHomeContent;
