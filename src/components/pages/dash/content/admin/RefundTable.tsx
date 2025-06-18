import React from 'react';
import type { Activity, BurnUtxo } from './types';
import { FaCopy } from 'react-icons/fa6';
import { formatDate } from 'date-fns';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useState } from 'react';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { apiFetch } from '@/utils/api';
import { toToken } from 'satoshi-token';

interface RefundTableProps {
	refunds: Activity[];
	decimals: number;
	onCopyTxid?: (txid: string) => void;
	alwaysShow?: boolean;
	showViewAll?: boolean;
	title?: string;
	showRequester?: boolean;
}

export const RefundTable = ({
	refunds,
    decimals,
	onCopyTxid, 
	alwaysShow = false,
	showViewAll = false,
	title = "Refunds",
	showRequester = true,
}: RefundTableProps) => {
	// Pagination state
	const [currentPage, setCurrentPage] = useState(1);
	const itemsPerPage = 6;
	const totalItems = refunds.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

	// Reset page when burns change
	useEffect(() => {
		setCurrentPage(1);
	}, [refunds.length]);

	// Paginated burns
	const indexOfLastItem = currentPage * itemsPerPage;
	const indexOfFirstItem = indexOfLastItem - itemsPerPage;
	const currentRefund = refunds.slice(indexOfFirstItem, indexOfLastItem);

	if (!alwaysShow && refunds.length === 0) return null;

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
							{showRequester && <th>Requester</th>}
							<th>Time</th>
                            {/* <th>Transaction</th> */}
						</tr>
					</thead>
					<tbody>
						{refunds.length === 0 ? (
							<tr>
								<td colSpan={showRequester ? 6 : 5} className="text-center">
									No refunds found
								</td>
							</tr>
						) : (
							currentRefund.map(refund => {
								const createdAt = refund.createdAt || '';

								return (
									<tr key={refund.outpoint}>
										<td>
											<div className="font-mono">
												{toToken(refund.amount?.toString() || '', decimals)} MNEE
											</div>
										</td>
										<td>
											{refund && (
												<div className={`badge ml-2 badge-secondary`}>
											        REFUNDED
												</div>
											)}
										</td>
										{showRequester && (
											<td>
												<div className="space-y-1">
													<div className="text-sm">
														{refund.requester.email}
													</div>
                                                    <div className="text-xs text-base-content/70">
                                                        {refund.approvals?.length > 0 && (
                                                            <div>
                                                                Approved by: {refund.approvals.map(a => a.approver?.name || a.approver?.email).join(', ')}
                                                            </div>
                                                        )}
                                                    </div>
												</div>
											</td>
										)}
										<td>
											<div className="text-xs">
												{formatDate(createdAt, 'PPpp')}
											</div>
										</td>
                                        {/* <td>
											<div className="flex flex-col items-center gap-2">
												<div className="flex font-mono text-xs">
													{refund.txid?.slice(0, 8)}...{refund.txid?.slice(-8)}
													{onCopyTxid && (
														<button
															type="button"
															className="btn btn-ghost btn-xs btn-square"
															onClick={() => refund.txid && onCopyTxid(refund.txid)}
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
														href={`https://whatsonchain.com/tx/${refund.outpoint}?tab=m8eqcrbs`}
														target="_blank"
														rel="noopener noreferrer"
														className="btn btn-link btn-xs p-0"
													>
														View on Explorer{" "}
														<MdOutlineOpenInNew className="w-3 h-3" />
													</a>
												</div>
											</div>
										</td> */}
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