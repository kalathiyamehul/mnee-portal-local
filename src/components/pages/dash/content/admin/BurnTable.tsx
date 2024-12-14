import { formatDistanceToNow } from "date-fns";
import { FaCopy } from "react-icons/fa6";
import { MdOutlineOpenInNew } from "react-icons/md";
import { toToken } from 'satoshi-token';
import type { BurnUtxo } from "./types";
import Link from "next/link";

const getRowBorderClass = (status: string | undefined) => {
	switch (status) {
		case 'PENDING':
			return 'border-l-4 border-l-warning';
		case 'APPROVED':
			return 'border-l-4 border-l-success';
		case 'REFUNDED':
			return 'border-l-4 border-l-info';
		case 'CANCELLED':
			return 'border-l-4 border-l-error';
		default:
			return 'border-l-4 border-l-secondary';
	}
};

interface BurnTableProps {
	title?: string;
	burns: BurnUtxo[];
	decimals: number;
	onCopyTxid: (txid: string) => void;
	alwaysShow?: boolean;
	showViewAll?: boolean;
}

const BurnTableContent = ({ 
	burns,
	decimals,
	onCopyTxid,
}: { 
	burns: BurnUtxo[],
	decimals: number,
	onCopyTxid: (txid: string) => void,
}) => {
	if (burns.length === 0) {
		return (
			<div className="text-center py-8 text-base-content/70">
				No completed burns found
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="table w-full">
				<thead>
					<tr>
						<th>Transaction</th>
						<th>Amount</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{burns.map((burn) => (
						<tr 
							key={`${burn.txid}_${burn.vout}_${burn.burnRequest?.id || 'new'}_${burn.burnRequest?.createdAt || Date.now()}`} 
							className={`hover ${getRowBorderClass(burn.burnRequest?.status)}`}
						>
							<td>
								<div className="flex flex-col gap-1">
									<span className="font-mono text-sm">
										{burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
									</span>
									<div className="flex items-center gap-1">
										<button
											onClick={() => onCopyTxid(burn.txid)}
											className="btn btn-ghost btn-xs btn-square"
										>
											<FaCopy className="w-3 h-3" />
										</button>
										<a
											href={`https://whatsonchain.com/tx/${burn.txid}`}
											target="_blank"
											rel="noopener noreferrer"
											className="btn btn-ghost btn-xs btn-square"
										>
											<MdOutlineOpenInNew className="w-3 h-3" />
										</a>
									</div>
								</div>
							</td>
							<td className="font-medium">
								{toToken(burn.data.bsv21.amt, decimals)} MNEE
							</td>
							<td>
								<div className="flex flex-col gap-1">
									<span className={`badge badge-sm ${
										burn.burnRequest?.status === 'APPROVED' ? 'badge-success' :
										burn.burnRequest?.status === 'REFUNDED' ? 'badge-info' :
										burn.burnRequest?.status === 'PENDING' ? 'badge-ghost' :
										burn.burnRequest?.status === 'CANCELLED' ? 'badge-secondary' :
										'badge-warning'
									}`}>
										{burn.burnRequest?.status || 'NEW'}
									</span>
									{burn.burnRequest?.createdAt && (
										<span className="text-xs text-base-content/70">
											{formatDistanceToNow(new Date(burn.burnRequest.createdAt), { addSuffix: true })}
										</span>
									)}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

export const BurnTable = ({ 
	title, 
	burns, 
	decimals,
	onCopyTxid,
	alwaysShow = false,
	showViewAll = false
}: BurnTableProps) => {
	if (!alwaysShow && burns.length === 0) {
		return null;
	}

	return (
		<div className="mb-8">
			{title && (
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-semibold">{title}</h2>
					{showViewAll && (
						<Link 
							href="/dash/admin?tab=burns" 
							className="btn btn-ghost btn-sm"
						>
							View All
						</Link>
					)}
				</div>
			)}
			<div className="bg-base-100 rounded-lg">
				<BurnTableContent 
					burns={burns}
					decimals={decimals}
					onCopyTxid={onCopyTxid}
				/>
			</div>
		</div>
	);
}; 