import { FaSnowflake, FaCoins } from 'react-icons/fa6';
import { ActivityCard } from './ActivityCard';
import type { ActivityListProps } from './types';

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
  showModal,
}: Omit<ActivityListProps, 'session'>) => {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <label className="label cursor-pointer gap-2 px-2">
          <span className="label-text text-sm">Pending Only</span>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm sm:toggle-md"
            checked={showOnlyPending}
            onChange={(e) => setShowOnlyPending(e.target.checked)}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => showModal('freeze_modal')}
          >
            <FaSnowflake className="mr-1" /> 
            <span className="text-sm">Restrict</span>
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => showModal('mint_modal')}
          >
            <FaCoins className="mr-1" /> 
            <span className="text-sm">Mint</span>
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {filteredActivities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            config={config}
            loading={loading}
            canCancel={canCancel}
            canApprove={canApprove}
            handleCancel={handleCancel}
            handleApprove={handleApprove}
            getActivityIcon={getActivityIcon}
            getActivityDisplayText={getActivityDisplayText}
            requiresApproval={requiresApproval}
            getApprovalCount={getApprovalCount}
          />
        ))}
      </div>
    </div>
  );
}; 