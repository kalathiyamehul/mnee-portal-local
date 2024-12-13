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
}: Omit<ActivityListProps, 'session'>) => {
  return (
    <div>
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
      <div className="space-y-3">
        {filteredActivities?.map((activity) => (
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