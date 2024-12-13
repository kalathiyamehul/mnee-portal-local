import { ActivityList } from './ActivityList';
import type { Activity, ConfigWithFees } from './types';
import type { IconType } from 'react-icons';

interface ActivityTabProps {
  activities: Activity[];
  showOnlyPending: boolean;
  onShowOnlyPendingChange: (value: boolean) => void;
  filteredActivities: Activity[];
  config: ConfigWithFees | null;
  loading: boolean;
  canCancel: (activity: Activity) => boolean;
  canApprove: (activity: Activity) => boolean;
  onCancel: (id: string, type: Activity['type']) => Promise<void>;
  onApprove: (id: string, type: Activity['type']) => Promise<void>;
  getActivityIcon: (activity: Activity) => IconType;
  getActivityDisplayText: (activity: Activity) => string;
  requiresApproval: (activity: Activity) => boolean;
  getApprovalCount: (activity: Activity) => number;
  showModal: (id: string) => void;
}

export const ActivityTab = ({
  showOnlyPending,
  onShowOnlyPendingChange: setShowOnlyPending,
  filteredActivities,
  config,
  loading,
  canCancel,
  canApprove,
  onCancel: handleCancel,
  onApprove: handleApprove,
  getActivityIcon,
  getActivityDisplayText,
  requiresApproval,
  getApprovalCount,
  showModal,
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
        showModal={showModal}
      />
    </div>
  );
}; 