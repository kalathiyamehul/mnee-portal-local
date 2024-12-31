import { BurnUtxo } from './types';
import { toToken } from 'satoshi-token';
import { FaCopy } from 'react-icons/fa6';
import { formatDistanceToNow } from 'date-fns';

interface BurnTableProps {
	burns: BurnUtxo[];
	decimals: number;
	onCopyTxid?: (txid: string) => void;
	alwaysShow?: boolean;
	showViewAll?: boolean;
	title?: string;
	showRequester?: boolean;
}

export const BurnTable = ({ 
	burns, 
	decimals, 
	onCopyTxid, 
	alwaysShow = false,
	showViewAll = false,
	title = "Burns",
	showRequester = true,
}: BurnTableProps) => {
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
						</tr>
					</thead>
					<tbody>
						{burns.length === 0 ? (
							<tr>
								<td colSpan={showRequester ? 5 : 4} className="text-center">
									No burns found
								</td>
							</tr>
						) : (
							burns.map((burn) => {
								const amount = burn.data.bsv21.amt;
								const status = burn.burnRequest?.status || 'PENDING';
								const createdAt = burn.burnRequest?.createdAt || new Date().toISOString();

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
												'badge-error'
											}`}>
												{status}
											</div>
										</td>
										<td>
											<div className="flex items-center gap-2">
												<div className="font-mono text-xs">
													{burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
												</div>
												{onCopyTxid && (
													<button
														className="btn btn-ghost btn-xs btn-square"
														onClick={() => onCopyTxid(burn.txid)}
													>
														<FaCopy className="w-3 h-3" />
													</button>
												)}
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
											<div className="text-sm">
												{formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
											</div>
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}; 