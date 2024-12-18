import { ActiveRestrictions } from './ActiveRestrictions';
import type { AddressStatus, Activity } from './types';
import type { MouseEvent } from 'react';
import { FaSnowflake, FaBan } from 'react-icons/fa6';
import { MdRemoveCircleOutline } from 'react-icons/md';
import { formatDistanceToNow } from 'date-fns';
import md5 from 'md5';
import type { Session } from 'next-auth';

interface ActiveRestrictionsTabProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleBlacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleFreezeRequest: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleUnfreeze: (address: string) => Promise<void>;
  showModal: (id: string) => void;
  activities: Activity[];
  handleCancel: (id: string, type: Activity["type"]) => Promise<void>;
  handleApprove: (id: string, type: Activity["type"]) => Promise<void>;
  session: Session;
}

export const ActiveRestrictionsTab = ({
  restrictions,
  loading,
  handleUnblacklist,
  handleBlacklist,
  handleFreezeRequest,
  handleUnfreeze,
  showModal,
  activities,
  handleCancel,
  handleApprove,
  session,
}: ActiveRestrictionsTabProps) => {
  // Filter activities to only show restriction-related ones
  const restrictionActivities = activities.filter(
    activity => activity.type === 'FREEZE' || activity.type === 'BLACKLIST'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const getActionBadgeClass = (activity: Activity) => {
    if (activity.type === 'BLACKLIST') {
      return 'badge-error';
    }
    return 'badge-info';
  };

  const getRowBorderClass = (activity: Activity) => {
    if (activity.type === 'BLACKLIST') {
      return 'border-l-4 border-l-error';
    }
    return 'border-l-4 border-l-info';
  };

  const getGravatarUrl = (email: string) => {
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

  const handleExplore = (address: string) => {
    window.open(`https://whatsonchain.com/address/${address}`, '_blank');
  };

  const canCancel = (activity: Activity) => {
    return activity.status === 'PENDING' && activity.requester.email === session?.user?.email;
  };

  const canApprove = (activity: Activity) => {
    if (activity.status !== 'PENDING') return false;
    if (activity.requester.email === session?.user?.email) return false;
    if (activity.type === 'BLACKLIST') return false; // blacklist auto-approves
    return !activity.approvals?.some(a => a.approver.email === session?.user?.email);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Active</h2>
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
        handleBlacklist={handleBlacklist}
        handleFreezeRequest={handleFreezeRequest}
        handleUnfreeze={handleUnfreeze}
      />

      <div className="divider" />

      <div>
        <h3 className="text-lg font-semibold mb-4">History</h3>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Requester</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restrictionActivities.map((activity) => (
                <tr key={activity.id} className={`hover ${getRowBorderClass(activity)}`}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar">
                        <div className="mask mask-squircle w-10 h-10">
                          <img
                            src={getGravatarUrl(activity.requester.email)}
                            alt="User avatar"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{activity.requester.email}</div>
                        <div className="text-sm opacity-50">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <button 
                        type="button"
                        onClick={() => activity.address && handleExplore(activity.address)}
                        className="font-mono text-sm link link-hover text-left"
                      >
                        {activity.address}
                      </button>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${getActionBadgeClass(activity)} badge-sm`}>
                          {activity.type === 'BLACKLIST' ? 
                            (activity.action === 'BLACKLIST' ? 'Blacklist' : 'Unblacklist') : 
                            (activity.action === 'FREEZE' ? 'Freeze' : 'Unfreeze')
                          }
                        </span>
                        {activity.status !== 'APPROVED' && (
                          <span className={`badge badge-sm ${activity.status === 'PENDING' ? 'badge-warning' : activity.status === 'CANCELLED' ? 'badge-error' : 'badge-success'}`}>
                            {activity.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {activity.status === 'PENDING' && (
                        <>
                          {canCancel(activity) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleCancel(activity.id, activity.type)}
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          )}
                          {canApprove(activity) && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApprove(activity.id, activity.type)}
                              disabled={loading}
                            >
                              Approve
                            </button>
                          )}
                        </>
                      )}
                      {activity.type === 'BLACKLIST' && activity.status === 'APPROVED' && (
                        restrictions.find(r => r.address === activity.address)?.isBlacklisted ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={(e) => activity.address && handleUnblacklist(e, activity.address)}
                            disabled={loading}
                          >
                            <MdRemoveCircleOutline className="w-3 h-3 mr-1" /> Unblacklist
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-error btn-sm"
                            onClick={(e) => activity.address && handleBlacklist(e, activity.address)}
                            disabled={loading}
                          >
                            <FaBan className="w-3 h-3 mr-1" /> Blacklist
                          </button>
                        )
                      )}
                      {activity.type === 'FREEZE' && activity.status === 'APPROVED' && (
                        restrictions.find(r => r.address === activity.address)?.isFrozen ? (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => activity.address && handleUnfreeze(activity.address)}
                            disabled={loading}
                          >
                            <FaSnowflake className="w-3 h-3 mr-1" /> Unfreeze
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={(e) => activity.address && handleFreezeRequest(e, activity.address)}
                            disabled={loading}
                          >
                            <FaSnowflake className="w-3 h-3 mr-1" /> Freeze
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 