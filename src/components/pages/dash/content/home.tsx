"use client";

import { FaBitcoinSign, FaUsers, FaCircleExclamation, FaMoneyBillTransfer } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MintTable } from "./admin/MintTable";
import { BurnTable } from "./admin/BurnTable";
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { toast } from 'react-hot-toast';
import type { Activity, BurnUtxo } from './admin/types';
import { TokenActivityChart } from "@/components/charts/TokenActivityChart";

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

const DashboardHomeContent = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
	const [decimals, setDecimals] = useState(DEFAULT_DECIMALS);

	// Default to 'volume' if no chart is selected
	const selectedChart = (searchParams.get('chart') || 'volume') as ChartType;

	const fetchConfig = async () => {
		try {
			const response = await fetch('/api/config');
			const config = await response.json();
			if (config?.decimals) {
				setDecimals(config.decimals);
			}
		} catch (error) {
			console.error('Error fetching config:', error);
		}
	};

	const fetchMetrics = () => {
		fetch("/api/dashboard")
			.then((response) => response.json())
			.then((data) => setMetrics(data))
			.catch((error) => console.error("Failed to fetch dashboard metrics:", error));
	};

	useEffect(() => {
		fetchConfig();
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
				<h2 className="text-xl font-semibold mb-4">
					{selectedChart === 'volume' && 'Token Volume History'}
					{selectedChart === 'mints' && 'Mint Transaction History'}
					{selectedChart === 'burns' && 'Burn Transaction History'}
					{selectedChart === 'customers' && 'Customer Growth'}
					{selectedChart === 'restrictions' && 'Restrictions History'}
				</h2>
				<TokenActivityChart 
					type={getChartType(selectedChart)}
					highlight={selectedChart === 'burns' ? 'burns' : 'mints'}
					height={350} 
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
						decimals={decimals}
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
