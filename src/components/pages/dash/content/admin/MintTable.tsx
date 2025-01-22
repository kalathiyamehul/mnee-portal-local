import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { FaCopy, FaSpinner } from "react-icons/fa6";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import type { Activity } from "./types";
import type { Session } from "next-auth";
import { MdOutlineOpenInNew } from "react-icons/md";
import { toToken } from "satoshi-token";
import { getConfig } from "@/lib/config";
import { useEffect, useState } from "react";
import type { Config } from "@/types";
import { getGravatarUrl } from "@/utils/gravatar";
import { useRouter } from "next/navigation";

const statusColors: Record<string, string> = {
	PENDING: "badge-warning",
	APPROVED: "badge-success",
	REJECTED: "badge-error",
	CANCELLED: "badge-neutral",
	DONE: "badge-success"
};

interface MintTableProps {
	title?: string;
	mints: Activity[];
	limit?: number;
	showViewAll?: boolean;
	onUpdate?: () => void;
	alwaysShow?: boolean;
	mode?: 'all' | 'active' | 'history';
	showActions?: boolean;
	showRequester?: boolean;
}

const getRowBorderClass = (status: string) => {
	switch (status) {
		case 'PENDING':
			return 'border-l-4 border-l-warning';
		case 'APPROVED':
		case 'DONE':
			return 'border-l-4 border-l-success';
		case 'REJECTED':
		case 'CANCELLED':
			return 'border-l-4 border-l-error';
		default:
			return '';
	}
};

const MintTableContent = ({ 
	mints, 
	session, 
	onUpdate,
	showActions,
	showRequester 
}: { 
	mints: Activity[], 
	session: Session | null, 
	onUpdate: (() => void) | undefined,
	showActions: boolean,
	showRequester: boolean 
}) => {
	const [config, setConfig] = useState<Config | null>(null);
	const [loadingApproval, setLoadingApproval] = useState<string | null>(null);
	const router = useRouter();

	const hasUserApproved = (mint: Activity) => {
		if (!session?.user?.email) return false;
		return mint.approvals?.some(approval => approval.approver?.email === session.user.email);
	};

	useEffect(() => {
		const getAndSetConfig = async () => {
			const config = await getConfig();
      if (!config) {
        // redirect to setup page
        router.push('/setup?fromDashAdminMints=true');
        return;
      }
			setConfig(config as Config);
		};

		getAndSetConfig();
	}, [router]);

	const handleApprove = async (id: string) => {
		try {
			setLoadingApproval(id);
			const response = await fetch("/api/approveMint", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ mintRequestId: id }),
			});

			const data = await response.json();

			if (response.status === 202) {
				// System is paused or address is frozen, show info toast
				toast(data.error || "Request will remain pending", {
					style: { background: '#3b82f6', color: 'white' }
				});
				onUpdate?.();
				return;
			}

			if (!response.ok) {
				throw new Error(data.error || "Failed to approve mint request");
			}

			if (data.success) {
				toast.success(data.message);
				onUpdate?.();
			} else {
				throw new Error(data.error || "Failed to approve mint request");
			}
		} catch (error) {
			console.error("Failed to approve mint request:", error);
			toast.error(error instanceof Error ? error.message : "Failed to approve mint request");
		} finally {
			setLoadingApproval(null);
		}
	};

	const handleCancel = async (id: string) => {
		try {
			const response = await fetch("/api/cancel", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ mintRequestId: id }),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to cancel mint request");
			}

			if (data.success) {
				toast.success("Mint request cancelled");
				onUpdate?.();
			} else {
				throw new Error(data.error || "Failed to cancel mint request");
			}
		} catch (error) {
			console.error("Failed to cancel mint request:", error);
			toast.error(error instanceof Error ? error.message : "Failed to cancel mint request");
		}
	};

	if (mints.length === 0) {
		return (
			<div className="text-center py-8 text-base-content/70">
				No mint requests found
			</div>
		);
	}

	if (!config) {
		return (
			<div className="text-center py-8 text-base-content/70">
				Loading...
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="table w-full">
				<thead>
					<tr>
						{showRequester && <th>Requester</th>}
						<th>Customer</th>
						<th>Address</th>
						<th>Amount</th>
						{showActions && <th>Actions</th>}
					</tr>
				</thead>
				<tbody>
					{mints.map((mint) => (
						<tr key={mint.id} className={`hover ${getRowBorderClass(mint.status)}`}>
							{showRequester && (
								<td>
									<div className="flex items-center gap-3">
										<div className="avatar">
											<div className="mask mask-squircle w-10 h-10">
												<img
													src={getGravatarUrl(mint.requester.email)}
													alt="Requester avatar"
												/>
											</div>
										</div>
										<div>
											<div className="font-medium">
												{mint.requester.name || mint.requester.email}
											</div>
											<div className="text-sm opacity-50">
												{formatDistanceToNow(new Date(mint.createdAt), { addSuffix: true })}
											</div>
										</div>
									</div>
								</td>
							)}
							<td>
								<div className="flex items-center gap-3">
									<div className="avatar">
										<div className="mask mask-squircle w-10 h-10">
											<img
												src={getGravatarUrl(mint.customer?.email)}
												alt="Customer avatar"
											/>
										</div>
									</div>
									<div>
										<div className="font-medium">
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
										</div>
										<div className="text-sm opacity-50">
											{mint.customer?.email || "unknown@example.com"}
										</div>
									</div>
								</div>
							</td>
							<td>
								<div className="flex flex-col gap-1">
									<span className="font-mono text-sm">
										{mint.address?.slice(0, 8)}...{mint.address?.slice(-8)}
									</span>
									<div className="flex items-center gap-1">
										<div className="tooltip tooltip-bottom" data-tip="Copy Address">
											<button
												type="button"
												onClick={() => {
													if (mint.address) {
														navigator.clipboard.writeText(mint.address);
														toast.success("Address copied");
													}
												}}
												className="btn btn-ghost btn-xs text-base-content/70 hover:text-base-content"
											>
												<FaCopy className="w-3 h-3" />
											</button>
										</div>
										<div className="tooltip tooltip-bottom" data-tip="View on WhatsOnChain">
											<a
												href={`https://whatsonchain.com/address/${mint.address}`}
												target="_blank"
												rel="noopener noreferrer"
												className="btn btn-ghost btn-xs text-base-content/70 hover:text-base-content"
											>
												<MdOutlineOpenInNew className="w-3 h-3" />
											</a>
										</div>
									</div>
								</div>
							</td>
							<td>
								<div className="flex flex-col gap-1">
									<div className="font-medium">
										{toToken(mint.amount as string, config.decimals)} MNEE
									</div>
									<div className="flex items-center gap-2">
										<span className={`badge badge-sm ${statusColors[mint.status]}`}>
											{mint.status}
										</span>
										{mint.status === 'PENDING' && (
											<span className="text-xs text-base-content/70">
												{mint.approvals?.length || 0}/2 Approvals
											</span>
										)}
									</div>
								</div>
							</td>
							{showActions && (
								<td>
									{mint.status === "PENDING" && session?.user && (
										<div className="flex gap-2 justify-end">
											{mint.requester.email === session.user.email ? (
												<button
													type="button"
													onClick={() => handleCancel(mint.id)}
													className="btn btn-ghost btn-xs"
													disabled={loadingApproval === mint.id}
												>
													Cancel
												</button>
											) : (
												<button
													type="button"
													onClick={() => handleApprove(mint.id)}
													className="btn btn-primary btn-xs"
													disabled={loadingApproval === mint.id || hasUserApproved(mint)}
												>
													{loadingApproval === mint.id ? (
														<>
															<FaSpinner className="animate-spin mr-1" />
															Approving...
														</>
													) : hasUserApproved(mint) ? (
														'Approved'
													) : (
														'Approve'
													)}
												</button>
											)}
										</div>
									)}
								</td>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export const MintTable = ({ 
	title, 
	mints, 
	limit, 
	showViewAll = false, 
	onUpdate, 
	alwaysShow = false,
	mode = 'all',
	showActions = true,
	showRequester = true
}: MintTableProps) => {
	const { data: session } = useSession();

	// Filter mints based on mode
	const filteredMints = mode === 'all' 
		? mints 
		: mode === 'active' 
			? mints.filter(mint => mint.status === "PENDING")
			: mints.filter(mint => mint.status !== "PENDING");

	// Apply limit if specified
	const displayMints = limit ? filteredMints.slice(0, limit) : filteredMints;

	if (!alwaysShow && displayMints.length === 0) {
		return null;
	}

	return (
		<div className="mb-8">
			{title && (
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-semibold">{title}</h2>
					{showViewAll && (
						<Link 
							href="/dash/admin?tab=mints" 
							className="btn btn-ghost btn-sm"
						>
							View All
						</Link>
					)}
				</div>
			)}
			<div className="bg-base-100 rounded-lg">
				<MintTableContent 
					mints={displayMints} 
					session={session} 
					onUpdate={onUpdate}
					showActions={showActions}
					showRequester={showRequester}
				/>
			</div>
		</div>
	);
}; 