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

interface Freeze extends HistoryRecord {
	address: string;
};

const DashboardAdminContent: React.FC = () => {
	const { data: session } = useSession();
	const [isPaused, setIsPaused] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
	const [loading, setLoading] = useState(true);
	const [history, setHistory] = useState<HistoryRecord[]>([]);
	const [freezeAddress, setFreezeAddress] = useState('');
	const [activeFreezes, setActiveFreezes] = useState<Freeze[]>([]);
	const [pendingFreezeRequests, setPendingFreezeRequests] = useState<Freeze[]>([]);
	const router = useRouter();

	// Fetch current status
	useEffect(() => {
		const fetchStatus = async () => {
			setLoading(true);
			try {
				const resStatus = await fetch("/api/status");
				const dataStatus = await resStatus.json();
				setIsPaused(dataStatus.isPaused);
				setIsPending(dataStatus.isPending);
				setPendingRequest(dataStatus.pendingRequest);
				setHistory(dataStatus.history);

				const resFreezes = await fetch('/api/freezeList');
				const dataFreezes = await resFreezes.json();
				setActiveFreezes(dataFreezes.activeFreezes);
				setPendingFreezeRequests(dataFreezes.pendingFreezeRequests);
			} catch (error) {
				console.error("Error fetching status:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchStatus();
	}, []);

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
			await fetch('/api/freeze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address: freezeAddress, action: 'FREEZE' }),
			});
			setFreezeAddress('');
			router.refresh();
		} catch (error) {
			console.error('Error creating freeze request:', error);
		}
	};

	const handleUnfreezeRequest = async (address: string) => {
		try {
			await fetch('/api/freeze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ address, action: 'UNFREEZE' }),
			});
			router.refresh();
		} catch (error) {
			console.error('Error creating unfreeze request:', error);
		}
	};

	if (loading) {
		return <FaSpinner className="animate-spin mx-auto my-12" />;
	}

	return (
		<div>
			<div className="my-4">
				<div className="flex items-center">
					<span className="mr-4">Global Pause</span>
					<input
						type="checkbox"
						className={`toggle ${
							isPending ? 'toggle-warning' : isPaused ? 'toggle-success' : 'toggle-gray'
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
							{pendingRequest?.requester.name || pendingRequest?.requester.email}
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
					<button type="button" className="btn btn-primary" onClick={handleFreeze}>
						Request Freeze
					</button>
				</div>
			</div>

			{/* Active Freezes List */}
			<div className="my-8">
				<h2 className="text-2xl mb-4">Active Freezes</h2>
				<table className="table w-full">
					<thead>
						<tr>
							<th>Address</th>
							<th>Requested By</th>
							<th>Timestamp</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{activeFreezes.map((freeze) => (
							<tr key={freeze.id}>
								<td>{freeze.address}</td>
								<td>{freeze.requester.name || freeze.requester.email}</td>
								<td>{new Date(freeze.createdAt).toLocaleString()}</td>
								<td>
									<button
										type="button"
										className="btn btn-outline btn-error btn-sm"
										onClick={() => handleUnfreezeRequest(freeze.address)}
									>
										<FaTimes />
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Pending Freeze Requests */}
			{pendingFreezeRequests?.length > 0 && (
				<div className="my-8">
					<h2 className="text-2xl mb-4">Pending Freeze/Unfreeze Requests</h2>
					{pendingFreezeRequests.map((request) => (
						<div key={request.id} className="flex items-center my-2">
							<p className="mr-4">
								{request.action} request for {request.address} by{' '}
								{request.requester.name || request.requester.email}
							</p>
							<button
								type="button"
								className="btn btn-primary"
								onClick={async () => {
									try {
										await fetch('/api/approveFreeze', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ freezeRequestId: request.id }),
										});
										router.refresh();
									} catch (error) {
										console.error('Error approving freeze request:', error);
									}
								}}
							>
								Approve
							</button>
						</div>
					))}
				</div>
			)}

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
