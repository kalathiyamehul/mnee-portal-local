import { toToken } from 'satoshi-token';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import type { ActivityCardProps } from './types';

export const ActivityCard = ({
  activity,
  config,
  session,
  loading,
  canCancel,
  canApprove,
  handleCancel,
  handleApprove,
  getActivityIcon,
  getActivityDisplayText,
  requiresApproval,
  getApprovalCount,
}: ActivityCardProps) => {
  // Filter out requester's approval from the approvals list
  const otherApprovals = activity.approvals.filter(
    approval => approval.approver.email !== activity.requester.email
  );

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-3 sm:p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2">
            {getActivityIcon(activity)}
            <span>{getActivityDisplayText(activity)}</span>
            {activity.type === 'FREEZE' && activity.address && (
              <div className="badge badge-sm">
                {activity.address.slice(0, 8)}...{activity.address.slice(-8)}
              </div>
            )}
            {activity.type === 'MINT' && (
              <div className="badge badge-sm">
                Amount: {toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)}
              </div>
            )}
            {activity.type === 'BURN' && (
              <div className="badge badge-sm">
                Amount: {toToken(activity.amount, config?.decimals || DEFAULT_DECIMALS)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`badge badge-sm ${
              activity.status === 'APPROVED' ? 'badge-success' :
              activity.status === 'PENDING' ? 'badge-warning' :
              'badge-error'
            }`}>
              {activity.status}
            </div>
            {!requiresApproval(activity) && (
              <div className="badge badge-sm badge-neutral">No Approval Required</div>
            )}
          </div>
        </div>

        {/* Approvals Section */}
        {requiresApproval(activity) && (
          <div className="mt-2">
            <div className="text-sm opacity-70">
              Approvals ({getApprovalCount(activity)}/2)
            </div>
            <div className="space-y-1">
              <div className="text-sm">
                ✓ {activity.requester.name || activity.requester.email} (Requester)
              </div>
              {otherApprovals.map((approval) => (
                <div key={approval.id} className="text-sm">
                  ✓ {approval.approver.name || approval.approver.email}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {activity.status === 'PENDING' && (
          <div className="card-actions justify-end mt-3">
            {canCancel(activity) && (
              <button
                className="btn btn-error btn-sm"
                onClick={() => handleCancel(activity.id, activity.type)}
                disabled={loading}
              >
                Cancel
              </button>
            )}
            {canApprove(activity) && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleApprove(activity.id, activity.type)}
                disabled={loading}
                title={
                  activity.requester.email === session?.user?.email
                    ? "Cannot approve your own request"
                    : activity.approvals.some(a => a.approver.email === session?.user?.email)
                    ? "Already approved"
                    : "Approve request"
                }
              >
                Approve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 