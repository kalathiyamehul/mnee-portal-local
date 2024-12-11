import { FaSpinner } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import type { Activity, ConfigWithFees } from './types';
import type { Session } from 'next-auth';
import type { IconType } from 'react-icons';

interface ActivityCardProps {
  activity: Activity;
  config: ConfigWithFees | null;
  session: Session | null;
  loading: boolean;
  canCancel: (activity: Activity) => boolean;
  canApprove: (activity: Activity) => boolean;
  handleCancel: (id: string, type: Activity['type']) => Promise<void>;
  handleApprove: (id: string, type: Activity['type']) => Promise<void>;
  getActivityIcon: (activity: Activity) => IconType;
  getActivityDisplayText: (activity: Activity) => string;
  requiresApproval: (activity: Activity) => boolean;
  getApprovalCount: (activity: Activity) => number;
}

export const ActivityCard = ({
  activity,
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
}: Omit<ActivityCardProps, 'session'>) => {
  // Filter out requester's approval from the approvals list
  const otherApprovals = activity.type === 'BLACKLIST' ? [] : 
    activity.approvals?.filter(
      approval => approval.approver.email !== activity.requester.email
    ) || [];

  const Icon = getActivityIcon(activity);

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-3 sm:p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={activity.type === 'BURN' ? 'text-red-500' : ''} />
            <span>{getActivityDisplayText(activity)}</span>
            {(activity.type === 'FREEZE' || activity.type === 'BLACKLIST') && activity.address && (
              <div className="badge badge-sm">
                {activity.address.slice(0, 8)}...{activity.address.slice(-8)}
              </div>
            )}
            {(activity.type === 'MINT' || activity.type === 'BURN') && (
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
            {activity.status === 'PENDING' && requiresApproval(activity) && (
              <div className="badge badge-sm badge-ghost">
                {getApprovalCount(activity)}/2 Approvals
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs opacity-70">
              By: {activity.requester.name || activity.requester.email}
            </div>
            {otherApprovals.length > 0 && (
              <div className="text-xs opacity-70">
                Approved by: {otherApprovals.map(a => a.approver.name || a.approver.email).join(', ')}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {canCancel(activity) && (
              <button
                type="button"
                className="btn btn-error btn-xs"
                onClick={() => handleCancel(activity.id, activity.type)}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : 'Cancel'}
              </button>
            )}
            {canApprove(activity) && (
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => handleApprove(activity.id, activity.type)}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : 'Approve'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 