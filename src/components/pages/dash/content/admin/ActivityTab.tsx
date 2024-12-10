import { ActivityList } from './ActivityList';
import type { Activity, ConfigWithFees } from './types';
import type { IconType } from 'react-icons';

interface ActivityTabProps {
  showOnlyPending: boolean;
  setShowOnlyPending: (value: boolean) => void;
  filteredActivities: Activity[];
  config: ConfigWithFees | null;
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

export const ActivityTab = ({
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
}: ActivityTabProps) => {
  return (
    <div className="p-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-4">Activity</h2>
      <ActivityList
        showOnlyPending={showOnlyPending}
        setShowOnlyPending={setShowOnlyPending}
        filteredActivities={filteredActivities}
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
    </div>
  );
}; 