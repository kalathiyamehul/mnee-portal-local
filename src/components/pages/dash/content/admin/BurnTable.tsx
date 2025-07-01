import React from 'react';
import type { BurnUtxo } from './types';
import { toToken } from 'satoshi-token';
import { FaCopy } from 'react-icons/fa6';
import { format, formatDate, formatDistanceStrict, formatDistanceToNow } from 'date-fns';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { formatRevalidate } from 'next/dist/server/lib/revalidate';
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useState } from 'react';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { apiFetch } from '@/utils/api';

interface BurnTableProps {
	burns: BurnUtxo[];
	decimals: number;
	onCopyTxid?: (txid: string) => void;
	alwaysShow?: boolean;
	showViewAll?: boolean;
	title?: string;
	showRequester?: boolean;
	showActions?: boolean;
	hasApproveBurnPer?: boolean;
	hasRejectBurnPer?: boolean;
    hasApproveRefundPer?: boolean;
	hasRejectRefundPer?: boolean;
	hasCreateRefundPer?: boolean;
	hasSettleBurnPer?: boolean;
}

export const BurnTable = ({
	burns, 
	decimals, 
	onCopyTxid, 
	alwaysShow = false,
	showViewAll = false,
	showActions,
	title = "Burns",
	showRequester = true,
    hasSettleBurnPer,
	hasApproveRefundPer,
	hasRejectBurnPer,
	hasRejectRefundPer,
}: BurnTableProps) => {
	const { data: session } = useSession();
	const [settlingId, setSettlingId] = React.useState<string | null>(null);

	const handleApproveRefund = async (refundId: string) => {
		try {
			const response = await apiFetch('/api/approveRefund', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ refundRequestId: refundId }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to approve refund request');
			}

			toast.success('Refund request approved');
		} catch (error) {
			// console.error('Error approving refund:', error);
			toast.error(error instanceof Error ? error.message : 'Failed to approve refund request');
		}
	};

	const handleRejectRefund = async (refundId: string) => {
		console.log("Refund Request ID:", refundId)
		try {
		  const response = await apiFetch("/api/reject", {
			method: "POST",
			headers: {
			  "Content-Type": "application/json",
			},
			body: JSON.stringify({
			  refundRequestId: refundId,
			}),
		  });
	
		  if (!response.ok) {
			const data = await response.json();
			throw new Error(data.error || "Failed to reject refund request");
		  }
	
		  toast.success("Refund request Rejected");
		} catch (error) {
		  // console.error("Error approving burn:", error);
		  toast.error(
			error instanceof Error
			  ? error.message
			  : "Failed to Reject refund request"
		  );
		}
	  };

	const handleSettleBurn = async (burnRequestId: string) => {
        setSettlingId(burnRequestId);
        try {
            const response = await apiFetch('/api/settleBurn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ burnRequestId }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to settle burn request');
            }

            toast.success('Burn request settled successfully');
            // Optionally, trigger a refresh or callback here
        } catch (error) {
            // console.error('Error settling burn:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to settle burn request');
        } finally {
            setSettlingId(null);
        }
    };

	const canApproveRefund = (burn: BurnUtxo) => {
		if (!burn.refundRequest || !session?.user?.email) return false;
		return burn.refundRequest.status === 'PENDING' && 
			burn.refundRequest.requester.email !== session.user.email &&
			!burn.refundRequest.approvals.some((approval: { approver?: { email: string } }) => approval.approver?.email === session.user.email);
	};

	const canRejectRefund = (burn: BurnUtxo) => {
		if (!burn.refundRequest || !session?.user?.email) return false;
		return (
		  burn.refundRequest.status === "PENDING" &&
		  burn.refundRequest.requester.email !== session.user.email &&
		  !burn.refundRequest.approvals.some((approval: { approver?: { email: string } }) => approval.approver?.email === session.user.email)
		);
	  };

	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 6;
	const totalItems = burns.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

	// Reset page when burns change
	useEffect(() => {
		setCurrentPage(1);
	}, [burns.length]);

	// Paginated burns
	const indexOfLastItem = currentPage * itemsPerPage;
	const indexOfFirstItem = indexOfLastItem - itemsPerPage;
	const currentBurns = burns.slice(indexOfFirstItem, indexOfLastItem);

	if (!alwaysShow && burns.length === 0) return null;

	return (
		<div>
			<div className="flex justify-between items-center mb-4">
				<h2 className="text-xl font-semibold">{title}</h2>
				{showViewAll && (
					<a href="/dash/admin?tab=burns" className="btn btn-ghost btn-sm">
						View All
					</a>
				)}
			</div>
			<div className="overflow-x-auto">
				<table className="table w-full">
					<thead>
						<tr>
							<th>Amount</th>
							<th>Status</th>
							<th>Transaction</th>
							{showRequester && <th>Requester</th>}
							<th>Time</th>
							{showActions && <th>Actions</th>}
						</tr>
					</thead>
					<tbody>
						{burns.length === 0 ? (
							<tr>
								<td colSpan={showRequester ? 6 : 5} className="text-center">
									No burns found
								</td>
							</tr>
						) : (
							currentBurns.map(burn => {
								const amount = burn.data.bsv21.amt;
								const status = burn.burnRequest?.status || 'PENDING';
								const createdAt = burn.burnRequest?.createdAt || '';

								return (
									<tr key={burn.outpoint}>
										<td>
											<div className="font-mono">
												{toToken(amount.toString(), decimals)} MNEE
											</div>
										</td>
										<td>
											<div className={`badge ${
												status === 'PENDING' ? 'badge-warning' :
												status === 'APPROVED' ? 'badge-success' :
												status === 'SETTLED'? 'badge-success' :
												status === 'REFUNDED' ? 'badge-info' :
												'badge-error'
											}`}>
												{status}
											</div>
										</td>
										<td>
											<div className="flex flex-col items-center gap-2">
												<div className="flex font-mono text-xs">
													{burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
													{onCopyTxid && (
														<button
															type="button"
															className="btn btn-ghost btn-xs btn-square"
															onClick={() => onCopyTxid(burn.txid)}
														>
															<FaCopy className="w-3 h-3" />
														</button>
													)}
												</div>
												<div
													className="tooltip tooltip-bottom"
													data-tip="View on WhatsOnChain"
													>
													<a
														href={`https://whatsonchain.com/tx/${burn.txid}?tab=m8eqcrbs`}
														target="_blank"
														rel="noopener noreferrer"
														className="btn btn-link btn-xs p-0"
													>
														View on Explorer{" "}
														<MdOutlineOpenInNew className="w-3 h-3" />
													</a>
												</div>
											</div>
										</td>
										{showRequester && burn.burnRequest?.requester && (
											<td>
												<div className="space-y-1">
													<div className="text-sm">
														{burn.burnRequest.requester.name || burn.burnRequest.requester.email}
													</div>
													{burn.burnRequest.approvals?.length > 0 && (
														<div className="text-xs text-base-content/70">
															Approved by: {burn.burnRequest.approvals.map(a => a.approver?.name || a.approver?.email).join(', ')}
														</div>
													)}
												</div>
											</td>
										)}
										<td>
											<div className="text-xs">
												{formatDate(createdAt, 'PPpp')}
											</div>
										</td>
										{showActions && <td>
											{canApproveRefund(burn) && hasApproveRefundPer && (
												<button
													type="button"
													onClick={() => burn.refundRequest && handleApproveRefund(burn.refundRequest.id)}
													className="btn btn-success btn-sm"
												>
													Approve Refund
												</button>
											)}
											{/* Reject Refund */}
											{canRejectRefund(burn) && hasRejectRefundPer && (
												<button
												type="button"
												onClick={() =>
													burn.refundRequest &&
													handleRejectRefund(burn.refundRequest.id)
												}
												className="btn btn-error btn-sm"
												>
												Reject Refund
												</button>
											)}
											 {/* SETTLED Button */}
											 {burn.burnRequest?.status === 'APPROVED' && hasSettleBurnPer && (
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => burn.burnRequest?.id && handleSettleBurn(burn.burnRequest.id)}
                                                    disabled={settlingId === burn.burnRequest?.id}
                                                >
                                                    {settlingId === burn.burnRequest?.id ? 'Settling...' : 'Settle'}
                                                </button>
                                            )}
										</td>}
									</tr>
								);
							})
						)}
					</tbody>
				</table>
				{totalItems > itemsPerPage && (
					<div className="mt-4">
						<Pagination
							currentPage={currentPage}
							totalPages={totalPages}
							itemsPerPage={itemsPerPage}
							totalItems={totalItems}
							onPageChange={setCurrentPage}
						/>
					</div>
				)}
			</div>
		</div>
	);
};