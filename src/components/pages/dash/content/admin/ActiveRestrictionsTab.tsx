import { ActiveRestrictions } from './ActiveRestrictions';
import type { AddressStatus, Activity } from './types';
import type { MouseEvent } from 'react';
import { FaSnowflake } from 'react-icons/fa6';
import { formatDistanceToNow } from 'date-fns';

interface ActiveRestrictionsTabProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleFreezeRequest: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleUnfreeze: (address: string) => Promise<void>;
  showModal: (id: string) => void;
  activities: Activity[];
}

export const ActiveRestrictionsTab = ({
  restrictions,
  loading,
  handleUnblacklist,
  handleFreezeRequest,
  handleUnfreeze,
  showModal,
  activities,
}: ActiveRestrictionsTabProps) => {
  // Filter activities to only show restriction-related ones
  const restrictionActivities = activities.filter(
    activity => activity.type === 'FREEZE' || activity.type === 'BLACKLIST'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Active Restrictions</h2>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => showModal('freeze_modal')}
        >
          <FaSnowflake className="mr-1" /> 
          <span className="text-sm">Restrict</span>
        </button>
      </div>
      <ActiveRestrictions 
        restrictions={restrictions}
        loading={loading}
        handleUnblacklist={handleUnblacklist}
        handleFreezeRequest={handleFreezeRequest}
        handleUnfreeze={handleUnfreeze}
      />

      <div className="divider" />

      <div>
        <h3 className="text-lg font-semibold mb-4">Restrictions History</h3>
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Address</th>
                <th>Action</th>
                <th>Status</th>
                <th>Requested By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {restrictionActivities.map((activity) => (
                <tr key={activity.id} className="hover">
                  <td className="font-mono text-sm">{activity.address}</td>
                  <td>
                    <span className={`badge ${
                      activity.type === 'BLACKLIST' 
                        ? activity.action === 'BLACKLIST' ? 'badge-error' : 'badge-success'
                        : activity.action === 'FREEZE' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {activity.action}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      activity.status === 'PENDING' ? 'badge-warning' :
                      activity.status === 'APPROVED' ? 'badge-success' :
                      'badge-error'
                    }`}>
                      {activity.status}
                    </span>
                  </td>
                  <td>{activity.requester.name || activity.requester.email}</td>
                  <td>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 