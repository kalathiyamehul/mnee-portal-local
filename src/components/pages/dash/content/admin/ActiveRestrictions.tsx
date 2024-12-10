import { FaSpinner, FaBan, FaSnowflake } from 'react-icons/fa6';
import type { AddressStatus } from './types';

interface ActiveRestrictionsProps {
  activeRestrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (e: React.MouseEvent<HTMLButtonElement>, address: string) => void;
  handleFreezeRequest: (e: React.FormEvent<HTMLFormElement | HTMLButtonElement>, address: string) => void;
  handleUnfreeze: (address: string) => void;
}

export const ActiveRestrictions = ({
  activeRestrictions,
  loading,
  handleUnblacklist,
  handleFreezeRequest,
  handleUnfreeze
}: ActiveRestrictionsProps) => (
  <div className="mb-6 overflow-x-auto">
    <h2 className="text-xl sm:text-2xl font-bold mb-2">Active Restrictions</h2>
    <table className="table table-compact sm:table-normal w-full">
      <thead>
        <tr>
          <th className="text-xs sm:text-sm">Address</th>
          <th className="text-xs sm:text-sm">Status</th>
          <th className="text-xs sm:text-sm">Actions</th>
        </tr>
      </thead>
      <tbody>
        {activeRestrictions.map((status) => (
          <tr key={status.address}>
            <td className="font-mono text-xs sm:text-sm max-w-[120px] sm:max-w-none truncate">
              {status.address}
            </td>
            <td>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {status.isBlacklisted ? (
                  <span className="badge badge-error badge-sm sm:badge-md gap-1">
                    <FaBan className="w-3 h-3" /> Blacklisted
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-error btn-xs sm:btn-sm"
                    onClick={(e) => handleUnblacklist(e, status.address)}
                  >
                    <FaBan className="w-3 h-3 mr-1" /> Block
                  </button>
                )}
                {status.isFrozen ? (
                  <span className="badge badge-error badge-sm sm:badge-md gap-1">
                    <FaSnowflake className="w-3 h-3" /> Frozen
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-xs sm:btn-sm"
                    onClick={(e) => handleFreezeRequest(e, status.address)}
                  >
                    <FaSnowflake className="w-3 h-3 mr-1" /> Freeze
                  </button>
                )}
              </div>
            </td>
            <td>
              <div className="flex flex-wrap gap-1 sm:gap-2">
                {status.isBlacklisted && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs sm:btn-sm"
                    onClick={(e) => handleUnblacklist(e, status.address)}
                    disabled={loading}
                  >
                    {loading ? (
                      <FaSpinner className="animate-spin w-3 h-3" />
                    ) : (
                      <>
                        <FaBan className="w-3 h-3 mr-1" />
                        <span className="text-xs sm:text-sm">Unblock</span>
                      </>
                    )}
                  </button>
                )}
                {status.isFrozen && (
                  <button
                    type="button"
                    className="btn btn-outline btn-xs sm:btn-sm"
                    onClick={() => handleUnfreeze(status.address)}
                    disabled={loading}
                  >
                    {loading ? (
                      <FaSpinner className="animate-spin w-3 h-3" />
                    ) : (
                      <>
                        <FaSnowflake className="w-3 h-3 mr-1" />
                        <span className="text-xs sm:text-sm">Unfreeze</span>
                      </>
                    )}
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