"use client";

import { useCallback, useEffect, useState } from 'react';
import { FaLock, FaSpinner } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import { useSession } from "next-auth/react";
import { FaFire, FaPause, FaPlay, FaSnowflake } from 'react-icons/fa6';

interface Approval {
	id: string;
	approver: {
		name: string | null;
		email: string;
	};
}

interface Activity {
	type: 'ACTION' | 'FREEZE';
	id: string;
	action: string;
	status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	createdAt: string;
	address?: string;
	requester: {
		name: string | null;
		email: string;
	};
	approvals: Approval[];
}

const DashboardAdminContent = () => {
	const { data: session } = useSession();
	const [loading, setLoading] = useState(true);
	const [isPaused, setIsPaused] = useState(false);
	const [activities, setActivities] = useState<Activity[]>([]);

	const fetchStatus = useCallback(async () => {
		try {
			const response = await fetch('/api/status');
			const data = await response.json();
			setIsPaused(data.isPaused);
			setActivities(data.activities);
		} catch (error) {
			console.error('Error fetching status:', error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchStatus();
		// Poll for updates every 5 seconds
		const interval = setInterval(fetchStatus, 5000);
		return () => clearInterval(interval);
	}, [fetchStatus]);

	const handlePauseToggle = async () => {
		try {
			setLoading(true);
			const action = isPaused ? 'RESUME' : 'PAUSE';
			await fetch('/api/pause', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action }),
			});
			await fetchStatus();
		} catch (error) {
			console.error('Error toggling pause state:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleApprove = async (id: string, type: 'ACTION' | 'FREEZE') => {
		try {
			setLoading(true);
			const endpoint = type === 'ACTION' ? '/api/approve' : '/api/approveFreeze';
			const body = type === 'ACTION' ? { actionId: id } : { freezeRequestId: id };
			
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to approve request');
			}

			await fetchStatus();
		} catch (error) {
			console.error('Error approving request:', error);
			alert(error instanceof Error ? error.message : 'Failed to approve request');
		} finally {
			setLoading(false);
		}
	};

	const canApprove = (activity: Activity) => {
		if (!session?.user?.email) return false;
		if (activity.status !== 'PENDING') return false;
		if (activity.requester.email === session.user.email) return false;
		return !activity.approvals.some(approval => approval.approver.email === session.user.email);
	};

	const renderActivityDetails = (activity: Activity) => {
		const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });
		const approvalCount = activity.approvals.length;
		const isPending = activity.status === 'PENDING';

		return (
			<div key={activity.id} className="card bg-base-200 shadow-xl mb-4">
				<div className="card-body">
					<div className="flex justify-between items-start">
						<div>
							<h3 className="card-title">
								{activity.type === 'FREEZE' ? (
									<>
                  {activity.action === 'FREEZE' ? <FaSnowflake /> : <FaFire />}
										{activity.action === 'FREEZE' ? 'Freeze' : 'Unfreeze'} Request
										<div className="badge badge-sm ml-2">
											{activity.address?.slice(0, 8)}...{activity.address?.slice(-8)}
										</div>
									</>
								) : (
									<>
                  {activity.action === 'PAUSE' ? <FaPause /> : <FaPlay />}
										{activity.action === 'PAUSE' ? 'Pause' : 'Unpause'} Request
									</>
								)}
							</h3>
							<p className="text-sm opacity-70">
								Requested by {activity.requester.name || activity.requester.email} {timeAgo}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<div className={`badge ${activity.status === 'APPROVED' ? 'badge-success' : 
								activity.status === 'PENDING' ? 'badge-warning' : 'badge-error'}`}>
								{activity.status}
							</div>
						</div>
					</div>

					{/* Approvals Section */}
					<div className="mt-4">
						<h4 className="font-semibold mb-2">Approvals ({approvalCount}/2)</h4>
						<div className="space-y-2">
							{activity.approvals.map((approval) => (
								<div key={approval.id} className="text-sm opacity-80">
									✓ {approval.approver.name || approval.approver.email}
									{approval.approver.email === activity.requester.email && (
										<span className="text-info ml-2">(requester)</span>
									)}
								</div>
							))}
						</div>
					</div>

					{/* Approve Button */}
					{isPending && (
						<div className="card-actions justify-end mt-4">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => handleApprove(activity.id, activity.type)}
									disabled={loading || !canApprove(activity)}
									title={
										activity.requester.email === session?.user?.email
											? "Cannot approve your own request"
											: activity.approvals.some(a => a.approver.email === session?.user?.email)
											? "Already approved"
											: "Approve request"
									}
							>
								{loading ? <FaSpinner className="animate-spin" /> : 'Approve'}
							</button>
						</div>
					)}
				</div>
			</div>
		);
	};

	if (loading && activities.length === 0) {
		return (
			<div className="flex justify-center items-center min-h-[200px]">
				<FaSpinner className="animate-spin text-2xl" />
			</div>
		);
	}

	// Find any pending pause/resume request
	const pendingPauseRequest = activities.find(
		a => a.type === 'ACTION' && 
		a.status === 'PENDING' && 
		(a.action === 'PAUSE' || a.action === 'RESUME')
	);

	return (
		<div className="p-6">
			<div className="mb-8">
				<h2 className="text-2xl font-bold mb-4">System Status</h2>
				<div className="flex items-center gap-4">
					<div className={`badge badge-lg ${isPaused ? 'badge-warning' : 'badge-success'}`}>
            {isPaused ? <FaPause /> : <FaPlay />}
						{isPaused ? 'Paused' : 'Active'}
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm">Toggle System State:</span>
						<input
							type="checkbox"
							className={`toggle ${pendingPauseRequest ? 'toggle-warning' : isPaused ? 'toggle-error' : 'toggle-success'}`}
							checked={isPaused}
							onChange={handlePauseToggle}
							disabled={!!pendingPauseRequest}
						/>
					</div>
					{pendingPauseRequest && (
						<span className="text-warning text-sm">
							State change pending approval
						</span>
					)}
				</div>
			</div>

			<div>
				<h2 className="text-2xl font-bold mb-4">Activity</h2>
				{activities.length === 0 ? (
					<div className="text-center py-8 text-gray-500">
						No activity to display
					</div>
				) : (
					<div className="space-y-4">
						{activities.map(renderActivityDetails)}
					</div>
				)}
			</div>
		</div>
	);
};

export default DashboardAdminContent;
