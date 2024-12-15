import { FaSpinner } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import type { ActivityListProps } from './types';
import { formatDistanceToNow } from 'date-fns';

export const ActivityList = ({
  showOnlyPending,
  setShowOnlyPending,
  filteredActivities,
  config,
  loading,
  canCancel,
  canApprove,
  handleCancel,
  handleApprove,
  getActivityIcon,
  getActivityDisplayText,
  requiresApproval,
  getApprovalCount,
  showPendingSwitch = true,
  showRequester = true,
}: Omit<ActivityListProps, 'session'>) => {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'badge-warning';
      case 'APPROVED':
      case 'DONE':
        return 'badge-success';
      case 'REJECTED':
      case 'CANCELLED':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  };

  return (
    <div>
      {showPendingSwitch && (
        <div className="flex flex-wrap items-center gap-2 mb-4 justify-end">
          <label className="label cursor-pointer gap-2 px-2">
            <span className="label-text text-sm mr-2">Pending Only</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm sm:toggle-md"
              checked={showOnlyPending}
              onChange={(e) => setShowOnlyPending(e.target.checked)}
            />
          </label>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">Activity</th>
              <th className="bg-base-100">Details</th>
              <th className="bg-base-100">Status</th>
              {showRequester && <th className="bg-base-100">Requested By</th>}
              <th className="bg-base-100 w-[180px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={showRequester ? 5 : 4} className="text-center">
                  <FaSpinner className="animate-spin inline-block" />
                </td>
              </tr>
            ) : filteredActivities.length === 0 ? (
              <tr>
                <td colSpan={showRequester ? 5 : 4} className="text-center">
                  No activities found
                </td>
              </tr>
            ) : (
              filteredActivities.map((activity) => {
                const Icon = getActivityIcon(activity);
                const displayText = getActivityDisplayText(activity);
                const needsApproval = requiresApproval(activity);
                const approvalCount = getApprovalCount(activity);
                const otherApprovals = activity.type === 'BLACKLIST' ? [] : 
                  activity.approvals?.filter(
                    approval => approval.approver.email !== activity.requester.email
                  ) || [];

                return (
                  <tr
                    key={activity.id}
                    className={`hover border-l-4 ${
                      activity.status === 'PENDING' ? 'border-l-warning' :
                      activity.status === 'APPROVED' || activity.status === 'DONE' ? 'border-l-success' :
                      'border-l-error'
                    }`}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <Icon className={activity.type === 'BURN' ? 'text-red-500 w-4 h-4' : 'w-4 h-4'} />
                        <div className="flex flex-col gap-1">
                          <span>{activity.type}</span>
                          {(activity.type === 'MINT' || activity.type === 'BURN') && (
                            <div className="text-sm font-mono">
                              <span className="opacity-70">Amount:</span> {toToken(activity.amount as string, config?.decimals || DEFAULT_DECIMALS)} MNEE
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div>{displayText}</div>
                        {activity.customer && (
                          <>
                            <div className="text-sm">
                              <span className="opacity-70">Customer:</span> {activity.customer.name}
                            </div>
                            <div className="text-sm opacity-70">{activity.customer.email}</div>
                          </>
                        )}
                        {(activity.type === 'FREEZE' || activity.type === 'BLACKLIST' || (activity.type === 'MINT' && !activity.customer)) && activity.address && (
                          <div className="text-sm font-mono">
                            <span className="opacity-70">Address:</span> {activity.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span className={`badge ${getStatusBadgeClass(activity.status)}`}>
                          {activity.status}
                        </span>
                        {activity.status === 'PENDING' && needsApproval && (
                          <span className="text-xs opacity-70">
                            {approvalCount}/2 Approvals
                          </span>
                        )}
                      </div>
                    </td>
                    {showRequester && (
                      <td>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {activity.requester.name || activity.requester.email}
                          </div>
                          {otherApprovals.length > 0 && (
                            <div className="text-xs opacity-70">
                              Approved by: {otherApprovals.map(a => a.approver.name || a.approver.email).join(', ')}
                            </div>
                          )}
                          <div className="text-xs opacity-70">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </div>
                          {activity.status === 'APPROVED' && activity.updatedAt && (
                            <div className="text-xs opacity-70">
                              Approved {formatDistanceToNow(new Date(activity.updatedAt), { addSuffix: true })}
                            </div>
                          )}
                        </div>
                      </td>
                    )}
                    <td>
                      <div className="flex gap-2 justify-end">
                        {canCancel(activity) && (
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => handleCancel(activity.id, activity.type)}
                          >
                            Cancel
                          </button>
                        )}
                        {canApprove(activity) && (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => handleApprove(activity.id, activity.type)}
                          >
                            Approve
                          </button>
                        )}
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