import type { Config } from '@prisma/client';
import { ActivityList } from './ActivityList';
import type { Activity } from './types';
import type { IconType } from 'react-icons';

interface ActivityTabProps {
  activities: Activity[];
  showOnlyPending: boolean;
  onShowOnlyPendingChange: (value: boolean) => void;
  filteredActivities: Activity[];
  config: Config | null;
  loading: boolean;
  canCancel: (activity: Activity) => boolean;
  canApprove: (activity: Activity) => boolean;
  onCancel: (id: string, type: Activity['type']) => Promise<void>;
  onApprove: (id: string, type: Activity['type']) => Promise<void>;
  getActivityIcon: (activity: Activity) => IconType;
  getActivityDisplayText: (activity: Activity) => string;
  requiresApproval: (activity: Activity) => boolean;
  getApprovalCount: (activity: Activity) => number;
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
}: ActivityTabProps) => {
  return (
    <div className="p-4">
      <ActivityList
        showOnlyPending={showOnlyPending}
        setShowOnlyPending={setShowOnlyPending}
        filteredActivities={filteredActivities}
        config={config as Config}
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