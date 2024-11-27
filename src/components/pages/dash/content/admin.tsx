"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FaSpinner, FaTimes } from "react-icons/fa";

type PendingRequest = {
	id: string;
	action: string;
	requestedBy: string;
	requester: { name: string; email: string };
};

type HistoryRecord = {
	id: string;
	action: string;
	requester: { name: string; email: string };
	status: string;
	createdAt: string;
};

interface Approval {
	id: string;
	actionRequestId: string | null;
	freezeRequestId: string;
	approvedBy: string;
	createdAt: string;
	approver: {
		name: string | null;
		email: string;
	};
}

interface Freeze extends HistoryRecord {
	address: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	approvals: Approval[];
	requestedBy: string;
}

const DashboardAdminContent: React.FC = () => {
	const { data: session } = useSession();
	const [isPaused, setIsPaused] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
	const [loading, setLoading] = useState(true);
	const [history, setHistory] = useState<HistoryRecord[]>([]);
	const [freezeAddress, setFreezeAddress] = useState("");
	const [freezes, setFreezes] = useState<Freeze[]>([]);
	const router = useRouter();

	// Fetch current status
	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			try {
				const statusRes = await fetch("/api/status");
				const statusData = await statusRes.json();
				
				setIsPaused(statusData.isPaused);
				setIsPending(statusData.isPending);
				setPendingRequest(statusData.pendingRequest);
				setHistory(statusData.history);
				setFreezes(statusData.freezeRequests || []);
			} catch (error) {
				console.error("Error fetching data:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchData();
	}, []);

	const refreshData = async () => {
		try {
			const statusRes = await fetch("/api/status");
			const statusData = await statusRes.json();
			setFreezes(statusData.freezeRequests || []);
			setIsPaused(statusData.isPaused);
			setIsPending(statusData.isPending);
			setPendingRequest(statusData.pendingRequest);
			setHistory(statusData.history);
		} catch (error) {
			console.error("Error refreshing data:", error);
		}
	};

	const handleSwitchChange = async () => {
		if (isPending) {
			// Cancel the request if it's yours
			if (pendingRequest?.requestedBy === session?.user?.id) {
				try {
					await fetch("/api/cancel", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ actionRequestId: pendingRequest?.id }),
					});
					router.refresh();
				} catch (error) {
					console.error("Error cancelling request:", error);
				}
			}
		} else {
			// Create a new request
			const action = isPaused ? "RESUME" : "PAUSE";
			try {
				await fetch("/api/pause", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ action }),
				});
				router.refresh();
			} catch (error) {
				console.error("Error creating action request:", error);
			}
		}
	};

	const handleFreeze = async () => {
		try {
			await fetch("/api/freeze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address: freezeAddress, action: "FREEZE", callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/freezeComplete` }),
			});
			setFreezeAddress("");
			await refreshData();
		} catch (error) {
			console.error("Error creating freeze request:", error);
		}
	};

	const handleUnfreezeRequest = async (address: string) => {
		try {
			await fetch("/api/freeze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ address, action: "UNFREEZE", callbackUrl: `${process.env.NEXT_PUBLIC_MNEE_API}/v1/unfreezeComplete` }),
			});
			await refreshData();
		} catch (error) {
			console.error("Error creating unfreeze request:", error);
		}
	};

	const handleApproveFreeze = async (freezeRequestId: string) => {
		try {
			await fetch("/api/approveFreeze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ freezeRequestId }),
			});
			await refreshData();
		} catch (error) {
			console.error("Error approving freeze request:", error);
		}
	};

	const getStatusBadgeClass = (status: string) => {
		switch (status) {
			case 'PENDING':
				return 'badge badge-warning';
			case 'APPROVED':
				return 'badge badge-success';
			case 'REJECTED':
				return 'badge badge-error';
			case 'CANCELLED':
				return 'badge badge-ghost';
			default:
				return 'badge';
		}
	};

	const getApprovalCount = (freeze: Freeze) => {
		// Count requester as first approval plus any additional approvals
		// Filter out the requester's approval from the approvals array to avoid double counting
		const additionalApprovals = freeze.approvals.filter(a => a.approvedBy !== freeze.requestedBy).length;
		return 1 + additionalApprovals; // 1 for the requester plus additional approvals
	};

	if (loading) {
		return <FaSpinner className="animate-spin mx-auto my-12" />;
	}

	console.log('Current freezes:', freezes);
	console.log('Pending freezes:', freezes.filter(f => f.status === 'PENDING'));
	console.log('Approved freezes:', freezes.filter(f => f.status === 'APPROVED'));

	const approvedFreezes = freezes.filter(freeze => freeze.status === 'APPROVED');
	const pendingFreezes = freezes.filter(freeze => freeze.status === 'PENDING');

	const canApprove = (freeze: Freeze) => {
		if (freeze.status !== 'PENDING') return false;
		if (freeze.requestedBy === session?.user?.id) return false;
		return !freeze.approvals.some(a => a.approver.email === session?.user?.email);
	};

	return (
		<div>
			<div className="my-4">
				<div className="flex items-center">
					<span className="mr-4">Global Pause</span>
					<input
						type="checkbox"
						className={`toggle ${
							isPending
								? "toggle-warning"
								: isPaused
									? "toggle-success"
									: "toggle-gray"
						}`}
						checked={isPaused || isPending}
						onChange={handleSwitchChange}
						disabled={
							isPending && pendingRequest?.requestedBy !== session?.user?.id
						}
					/>
				</div>
				{isPending && (
					<p className="text-yellow-600 mt-2">Action is pending approval</p>
				)}
			</div>

			{isPending && pendingRequest?.requestedBy !== session?.user?.id && (
				<div className="my-4">
					<h2 className="text-xl">Pending Actions</h2>
					<div className="flex items-center my-2">
						<p className="mr-4">
							{pendingRequest?.action} request by{" "}
							{pendingRequest?.requester.name ||
								pendingRequest?.requester.email}
						</p>
						<button
							type="button"
							className="btn btn-primary"
							onClick={async () => {
								try {
									await fetch("/api/approve", {
										method: "POST",
										headers: { "Content-Type": "application/json" },
										body: JSON.stringify({
											actionRequestId: pendingRequest?.id,
										}),
									});
									router.refresh();
								} catch (error) {
									console.error("Error approving request:", error);
								}
							}}
						>
							Approve
						</button>
					</div>
				</div>
			)}

			{/* Freeze Address Input */}
			<div className="my-8">
				<h2 className="text-2xl mb-4">Freeze Address</h2>
				<div className="flex items-center">
					<input
						type="text"
						className="input input-bordered w-full max-w-md mr-4"
						placeholder="Enter Bitcoin SV Address"
						value={freezeAddress}
						onChange={(e) => setFreezeAddress(e.target.value)}
					/>
					<button
						type="button"
						className="btn btn-primary"
						onClick={handleFreeze}
					>
						Request Freeze
					</button>
				</div>
			</div>

			{/* Freeze Requests Table */}
			<div className="my-8">
				<h2 className="text-2xl mb-4">Freeze Requests</h2>
				<div className="overflow-x-auto">
					<table className="table table-zebra w-full">
						<thead>
							<tr>
								<th>Address</th>
								<th>Status</th>
								<th>Requested By</th>
								<th>Approvals</th>
								<th>Date</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{freezes.map((freeze) => (
								<tr key={freeze.id} className="hover">
									<td className="font-mono">{freeze.address}</td>
									<td>
										<span className={getStatusBadgeClass(freeze.status)}>
											{freeze.status}
										</span>
									</td>
									<td>{freeze.requester.name || freeze.requester.email}</td>
									<td>
										<div className="flex flex-col gap-1">
											<span className="text-sm">
												{getApprovalCount(freeze)} of 2 approvals
												{freeze.requestedBy === session?.user?.id && (
													<span className="text-xs text-info ml-2">(includes your request)</span>
												)}
											</span>
											<div className="text-xs opacity-70">
												<div>
													{freeze.requester.email === session?.user?.email ? (
														<span className="text-info">You (requester)</span>
													) : (
														`${freeze.requester.name || freeze.requester.email} (requester)`
													)}
												</div>
												{freeze.approvals
													.filter(approval => approval.approvedBy !== freeze.requestedBy)
													.map((approval) => (
														<div key={approval.id}>
															{approval.approver.email === session?.user?.email ? (
																<span className="text-success">You</span>
															) : (
																approval.approver.name || approval.approver.email
															)}
														</div>
													))}
											</div>
										</div>
									</td>
									<td>{new Date(freeze.createdAt).toLocaleString()}</td>
									<td>
										{freeze.status === 'PENDING' ? (
											<button
												type="button"
												className="btn btn-primary btn-sm"
												onClick={() => handleApproveFreeze(freeze.id)}
												disabled={!canApprove(freeze)}
												title={
													freeze.requestedBy === session?.user?.id
														? "Cannot approve your own request"
														: freeze.approvals.some(a => a.approver.email === session?.user?.email)
														? "Already approved"
														: "Approve request"
												}
											>
												Approve
											</button>
										) : freeze.status === 'APPROVED' ? (
											<button
												type="button"
												className="btn btn-outline btn-error btn-sm"
												onClick={() => handleUnfreezeRequest(freeze.address)}
											>
												<FaTimes />
											</button>
										) : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="my-4">
				<h2 className="text-2xl">Action History</h2>
				<table className="table w-full mt-4">
					<thead>
						<tr>
							<th>Action</th>
							<th>Requested By</th>
							<th>Status</th>
							<th>Timestamp</th>
						</tr>
					</thead>
					<tbody>
						{history.map((record) => (
							<tr key={record.id}>
								<td>{record.action}</td>
								<td>{record.requester.name || record.requester.email}</td>
								<td>{record.status}</td>
								<td>{new Date(record.createdAt).toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default DashboardAdminContent;
