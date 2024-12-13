import { FaBan, FaSnowflake } from 'react-icons/fa6';
import { MdRemoveCircleOutline } from 'react-icons/md';
import type { AddressStatus } from './types';
import type { MouseEvent } from 'react';
import md5 from 'md5';

interface ActiveRestrictionsProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleBlacklist: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleFreezeRequest: (e: MouseEvent<HTMLButtonElement>, address: string) => Promise<void>;
  handleUnfreeze: (address: string) => Promise<void>;
}

export const ActiveRestrictions = ({
  restrictions,
  loading,
  handleUnblacklist,
  handleBlacklist,
  handleFreezeRequest,
  handleUnfreeze
}: ActiveRestrictionsProps) => {
  const getGravatarUrl = (email: string) => {
    const hash = md5(email.toLowerCase().trim());
    return `https://www.gravatar.com/avatar/${hash}?d=mp&s=40`;
  };

  const handleExplore = (address: string) => {
    window.open(`https://whatsonchain.com/address/${address}`, '_blank');
  };

  return (
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
          {restrictions.map((status) => (
            <tr key={status.address}>
              <td>
                <div className="flex items-center gap-3">
                  <div className="avatar">
                    <div className="mask mask-squircle w-10 h-10">
                      <img
                        src={getGravatarUrl(status.requester.email)}
                        alt="User avatar"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{status.requester.email}</div>
                    <div className="text-sm opacity-50">
                      {status.lastUpdate}
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => handleExplore(status.address)}
                    className="font-mono text-sm link link-hover text-left"
                  >
                    {status.address}
                  </button>
                  <div className="flex items-center gap-2">
                    {status.isBlacklisted && (
                      <span className="badge badge-error badge-md gap-1">
                        <FaBan className="w-3 h-3" /> Blacklisted
                      </span>
                    )}
                    {status.isFrozen ? (
                      <span className="badge badge-error badge-md gap-1">
                        <FaSnowflake className="w-3 h-3" /> Frozen
                      </span>
                    ) : status.hasPendingFreeze ? (
                      <span className="badge badge-warning badge-md gap-1">
                        <FaSnowflake className="w-3 h-3" /> {status.pendingFreezeAction === 'UNFREEZE' ? 'Unfreezing' : 'Freezing'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </td>
              <td>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {!status.isBlacklisted && (
                    <button
                      type="button"
                      className="btn btn-error btn-sm"
                      onClick={(e) => handleBlacklist(e, status.address)}
                      disabled={loading}
                    >
                      <FaBan className="w-3 h-3 mr-1" /> Block
                    </button>
                  )}
                  {status.isBlacklisted && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={(e) => handleUnblacklist(e, status.address)}
                      disabled={loading}
                    >
                      <MdRemoveCircleOutline className="w-3 h-3 mr-1" /> Unblacklist
                    </button>
                  )}
                  {!status.isFrozen && !status.hasPendingFreeze && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={(e) => handleFreezeRequest(e, status.address)}
                      disabled={loading}
                    >
                      <FaSnowflake className="w-3 h-3 mr-1" /> Freeze
                    </button>
                  )}
                  {status.isFrozen && !status.hasPendingFreeze && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleUnfreeze(status.address)}
                      disabled={loading}
                    >
                      <FaSnowflake className="w-3 h-3 mr-1" /> Unfreeze
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 