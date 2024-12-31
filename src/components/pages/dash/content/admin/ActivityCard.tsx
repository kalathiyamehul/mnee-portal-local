import { FaSpinner } from 'react-icons/fa6';
import { toToken } from 'satoshi-token';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import type { Activity } from './types';
import type { Session } from 'next-auth';
import type { IconType } from 'react-icons';
import { Config } from '@prisma/client';

interface ActivityCardProps {
  activity: Activity;
  config: Config | null;
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
  const otherApprovals = activity.type === 'BLACKLIST' ? [] : 
    activity.approvals?.filter(
      approval => approval.approver?.email !== activity.requester.email
    ) || [];

  const Icon = getActivityIcon(activity);

  const getRowBorderClass = (activity: Activity) => {
    switch (activity.status) {
      case 'PENDING':
        return 'border-l-4 border-l-warning';
      case 'APPROVED':
      case 'DONE':
        return 'border-l-4 border-l-success';
      case 'REJECTED':
      case 'CANCELLED':
        return 'border-l-4 border-l-error';
      default:
        return '';
    }
  };

  return (
    <div className={`card bg-base-200 shadow-sm ${getRowBorderClass(activity)}`}>
      <div className="card-body p-3 sm:p-4">
        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Icon className={activity.type === 'BURN' ? 'text-red-500' : ''} />
              <span>{getActivityDisplayText(activity)}</span>
            </div>
            {activity.type === 'MINT' && (
              <div className="flex flex-col gap-1">
                {activity.customer ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                        Customer: {activity.customer.name}
                      </span>
                      <span className="px-2 py-1 text-xs bg-base-300/50 rounded-lg w-fit">
                        {activity.customer.email}
                      </span>
                    </div>
                    <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                      Amount: {toToken(activity.amount as string, config?.decimals || DEFAULT_DECIMALS)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                      Address: {activity.address}
                    </span>
                    <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                      Amount: {toToken(activity.amount as string, config?.decimals || DEFAULT_DECIMALS)}
                    </span>
                  </>
                )}
              </div>
            )}
            {activity.type === 'BURN' && (
              <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                Amount: {toToken(activity.amount as string, config?.decimals || DEFAULT_DECIMALS)}
              </span>
            )}
            {(activity.type === 'FREEZE' || activity.type === 'BLACKLIST') && activity.address && (
              <span className="px-2 py-1 text-xs bg-base-300 rounded-lg w-fit">
                {activity.address.slice(0, 8)}...{activity.address.slice(-8)}
              </span>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className={`px-2 py-1 text-xs rounded-lg ${
              activity.status === 'APPROVED' ? 'bg-success/20 text-success' :
              activity.status === 'PENDING' ? 'bg-warning/20 text-warning' :
              'bg-error/20 text-error'
            }`}>
              {activity.status}
            </span>
            {activity.status === 'PENDING' && requiresApproval(activity) && (
              <span className="px-2 py-1 text-xs bg-base-300 rounded-lg">
                {getApprovalCount(activity)}/2 Approvals
              </span>
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
                Approved by: {otherApprovals.map(a => a.approver?.name || a.approver?.email).join(', ')}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {canCancel(activity) && (
              <button
                type="button"
                className="px-2 py-1 text-xs bg-error/10 hover:bg-error/20 text-error rounded-lg transition-colors"
                onClick={() => handleCancel(activity.id, activity.type)}
                disabled={loading}
              >
                {loading ? <FaSpinner className="animate-spin" /> : 'Cancel'}
              </button>
            )}
            {canApprove(activity) && (
              <button
                type="button"
                className="px-2 py-1 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
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