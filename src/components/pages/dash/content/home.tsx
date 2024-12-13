"use client";

import { FaBitcoinSign, FaUsers, FaCircleExclamation, FaMoneyBillTransfer } from "react-icons/fa6";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

type DashboardMetrics = {
	totalCustomers: number;
	totalMintVolume: number;
	pendingMints: number;
	recentMints: Array<{
		id: string;
		amount: number;
		createdAt: string;
		customer: {
			name: string;
			email: string;
		} | null;
	}>;
	activeBlacklists: number;
};

const DashboardHomeContent = () => {
	const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

	useEffect(() => {
		fetch("/api/dashboard")
			.then((response) => response.json())
			.then((data) => setMetrics(data))
			.catch((error) => console.error("Failed to fetch dashboard metrics:", error));
	}, []);

	if (!metrics) {
		return <div>Loading...</div>;
	}

	return (
		<div className="p-4 space-y-8">
			<div className="stats shadow w-full">
				<Link href="/dash/customers" className="stat hover:bg-base-200 transition-colors cursor-pointer">
					<div className="stat-figure text-primary">
						<FaUsers className="w-8 h-8" />
					</div>
					<div className="stat-title">Total Customers</div>
					<div className="stat-value text-primary">{metrics.totalCustomers}</div>
					<div className="stat-desc">Active platform users</div>
				</Link>

				<Link href="/dash/admin" className="stat hover:bg-base-200 transition-colors cursor-pointer">
					<div className="stat-figure text-secondary">
						<FaBitcoinSign className="w-8 h-8" />
					</div>
					<div className="stat-title">24h Mint Volume</div>
					<div className="stat-value text-secondary">{metrics.totalMintVolume.toLocaleString()}</div>
					<div className="stat-desc">In tokens</div>
				</Link>

				<Link 
					href="/dash/admin?tab=mints" 
					className="stat hover:bg-base-200 transition-colors cursor-pointer"
				>
					<div className="stat-figure text-warning">
						<FaMoneyBillTransfer className="w-8 h-8" />
					</div>
					<div className="stat-title">Pending Mints</div>
					<div className="stat-value text-warning">{metrics.pendingMints}</div>
					<div className="stat-desc">Awaiting approval</div>
				</Link>

				<Link 
					href="/dash/admin?tab=restrictions" 
					className="stat hover:bg-base-200 transition-colors cursor-pointer"
				>
					<div className="stat-figure text-error">
						<FaCircleExclamation className="w-8 h-8" />
					</div>
					<div className="stat-title">Active Restrictions</div>
					<div className="stat-value text-error">{metrics.activeBlacklists}</div>
					<div className="stat-desc">Blacklisted addresses</div>
				</Link>
			</div>

			<div className="bg-base-100 rounded-lg shadow-lg p-6">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-semibold">Recent Mint Requests</h2>
					<Link 
						href="/dash/admin?tab=mints" 
						className="btn btn-ghost btn-sm"
					>
						View All
					</Link>
				</div>
				<div className="overflow-x-auto">
					<table className="table w-full">
						<thead>
							<tr>
								<th>Customer</th>
								<th>Amount</th>
								<th>Requested</th>
							</tr>
						</thead>
						<tbody>
							{metrics.recentMints.map((mint) => (
								<tr key={mint.id} className="hover">
									<td>
										{mint.customer ? (
											<Link 
												href={`/dash/customers?id=${mint.customer.email}`}
												className="hover:underline"
											>
												{mint.customer.name}
											</Link>
										) : (
											"Unknown"
										)}
									</td>
									<td>{mint.amount.toLocaleString()}</td>
									<td>{formatDistanceToNow(new Date(mint.createdAt), { addSuffix: true })}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default DashboardHomeContent;
