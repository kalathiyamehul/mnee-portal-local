import { FaBan, FaCopy, FaSnowflake } from "react-icons/fa6";
import { MdOutlineOpenInNew, MdRemoveCircleOutline } from "react-icons/md";
import type { Activity, AddressStatus } from "./types";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { getGravatarUrl } from "@/utils/gravatar";
import type { Session } from "next-auth";
import { Pagination } from "@/components/common/Pagination";
import CustomToast from "@/components/common/CustomToast";

interface ActiveRestrictionsProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (
    e: MouseEvent<HTMLButtonElement>,
    address: string, reason: string
  ) => Promise<void>;
  handleBlacklist: (
    e: MouseEvent<HTMLButtonElement>,
    address: string, reason: string
  ) => Promise<void>;
  handleFreezeRequest: (
    e: MouseEvent<HTMLButtonElement>,
    address: string, reason: string
  ) => Promise<void>;
  handleUnfreeze: (address: string, reason: string) => Promise<void>;
  activities: Activity[];
  handleCancel: (id: string, type: Activity["type"]) => Promise<void>;
  handleApprove: (id: string, type: Activity["type"]) => Promise<void>;
  session: Session;
  showActions?: boolean;
  permissions: {
    hasCreateBlacklistPer: boolean;
    hasApproveBlacklistPer: boolean;
    hasCreateFreezePer: boolean;
    hasApproveFreezePer: boolean;
  };
}

const handleCopyAddress = (txid: string) => {
  navigator.clipboard.writeText(txid);
  CustomToast.success("Address copied to clipboard");
};

export const ActiveRestrictions = ({
  restrictions,
  loading,
  handleUnblacklist,
  handleBlacklist,
  handleFreezeRequest,
  handleUnfreeze,
  activities,
  showActions,
  handleCancel,
  handleApprove,
  session,
  permissions,
}: ActiveRestrictionsProps) => {
  // useEffect(() => {
  //   for (const status of restrictions) {
  //     console.log('Status for address:', status.address, {
  //       isFrozen: status.isFrozen,
  //       hasPendingFreeze: status.hasPendingFreeze,
  //       pendingFreezeAction: status.pendingFreezeAction,
  //       requester: status.requester
  //     });
  //   }
  // }, [restrictions]);

  // console.log("restrictions", restrictions);

  const canCancel = (activity: Activity) => {
    if (!session?.user?.email) return false;
    return (
      activity.status === "PENDING" &&
      activity.requester.email === session.user.email
    );
  };

  const canApprove = (activity: Activity) => {
    if (!session?.user?.email) return false;
    if (activity.status !== "PENDING") return false;
    if (activity.type === "BLACKLIST" && !permissions.hasApproveBlacklistPer) return false;
    if (activity.type === "FREEZE" && !permissions.hasApproveFreezePer) return false;
    if (activity.requester.email === session.user.email) return false;
    return !activity.approvals?.some(
      (approval) => approval.approver?.email === session.user.email
    );
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const totalItems = restrictions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Reset page when restrictions change
  useEffect(() => {
    setCurrentPage(1);
  }, [restrictions.length]);

  // Paginated restrictions
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentRestrictions = restrictions.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Requester</th>
            <th>Address</th>
            <th>Details</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {currentRestrictions.map((status) => (
            <tr key={status.address}>
              <td className="w-1/6">
                <div className="flex items-center gap-3">
                  <div className="avatar">
                    <div className="mask mask-squircle w-10 h-10">
                      <img
                        src={getGravatarUrl(status.requester?.email)}
                        alt="User avatar"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">{status.requester?.email}</div>
                    <div className="text-sm opacity-50">
                      {status.lastUpdate}
                    </div>
                  </div>
                </div>
              </td>
              <td className="w-1/6">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col">
                    <div className="flex gap-1">
                      <a
                        href={`https://whatsonchain.com/address/${status.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="font-mono text-sm">
                          {status.address}
                        </span>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(status.address)}
                        className="btn btn-ghost btn-xs btn-square"
                      >
                        <FaCopy className="w-3 h-3" />
                      </button>
                    </div>
                    <div
                      className="tooltip tooltip-bottom"
                      data-tip="View on WhatsOnChain"
                    >
                      <a
                        href={`https://whatsonchain.com/address/${status.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-link btn-xs p-0"
                      >
                        View on Explorer{" "}
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status.isBlacklisted && (
                      <span className="badge badge-error badge-md gap-1">
                        <FaBan className="w-3 h-3" /> Blacklisted
                      </span>
                    )}
                    {status.isFrozen && !status.hasPendingFreeze && (
                      <span className="badge badge-error badge-md gap-1">
                        <FaSnowflake className="w-3 h-3" /> Frozen
                      </span>
                    )}
                    {status.hasPendingFreeze && (
                      <span className="badge badge-warning badge-md gap-1">
                        <FaSnowflake className="w-3 h-3" />{" "}
                        {status.pendingFreezeAction === "UNFREEZE"
                          ? "Unfreezing"
                          : "Freezing"}
                      </span>
                    )}
                    {status.hasPendingBlacklist && (
                      <span className="badge badge-warning badge-md gap-1">
                        <FaBan className="w-3 h-3" />{" "}
                        {status.pendingBlacklistAction === "UNBLACKLIST"
                          ? "Unblacklisting"
                          : "Blacklisting"}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="w-1/4">
                <div className="flex flex-col">
                  <p className="font-medium">Reason:</p>
                  <p className="opacity-70">{status?.reason}</p>
                </div>
              </td>
              {showActions && (
                <td className="w-1/4">
                  <div className="flex flex-wrap gap-2">
                    {!status.isBlacklisted &&
                      !status.hasPendingBlacklist &&
                      permissions.hasCreateBlacklistPer && (
                        <button
                          type="button"
                          className="btn btn-error btn-sm"
                          onClick={(e) => handleBlacklist(e, status.address, status.reason || '')}
                          disabled={loading}
                        >
                          <FaBan className="w-3 h-3 mr-1" /> Blacklist
                        </button>
                      )}
                    {status.isBlacklisted && !status.hasPendingBlacklist && permissions.hasCreateBlacklistPer && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={(e) => handleUnblacklist(e, status.address, status.reason || '')}
                        disabled={loading}
                      >
                        <MdRemoveCircleOutline className="w-3 h-3 mr-1" />{" "}
                        Unblacklist
                      </button>
                    )}
                    {status.isFrozen && !status.hasPendingFreeze && permissions.hasCreateFreezePer &&(
                      <button
                        type="button"
                        className="btn btn-sm btn-error"
                        onClick={() => handleUnfreeze(status.address, status.reason || '')}
                        disabled={loading}
                      >
                        <FaSnowflake className="w-3 h-3" /> Unfreeze
                      </button>
                    )}
                    {!status.isFrozen &&
                      !status.hasPendingFreeze &&
                      permissions.hasCreateFreezePer && (
                        <button
                          type="button"
                          className="btn btn-sm btn-error"
                          onClick={(e) =>
                            handleFreezeRequest(e, status.address, status.reason || '')
                          }
                          disabled={loading}
                        >
                          <FaSnowflake className="w-3 h-3" /> Freeze
                        </button>
                      )}
                    {((status.hasPendingFreeze &&
                      permissions.hasApproveFreezePer) ||
                      (status.hasPendingBlacklist &&
                        permissions.hasApproveBlacklistPer)) && (
                      <>
                        {/* Find the pending requests for this address */}
                        {activities
                          .filter(
                            (activity) =>
                              ((activity.type === "FREEZE" &&
                                status.hasPendingFreeze) ||
                                (activity.type === "BLACKLIST" &&
                                  status.hasPendingBlacklist)) &&
                              activity.address === status.address &&
                              activity.status === "PENDING"
                          )
                          .map((activity) => (
                            <div key={activity.id} className="flex gap-2">
                              {canCancel(activity) && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() =>
                                    handleCancel(activity.id, activity.type)
                                  }
                                  disabled={loading}
                                >
                                  {activity.type === "FREEZE" && (restrictions.find((r) => r.address === activity.address)?.isFrozen ? "Cancel Unfreeze" : "Cancel Freeze")}
                                  {activity.type === "BLACKLIST" &&
                                    (restrictions.find((r) => r.address === activity.address)?.isBlacklisted ? "Cancel Unblacklist" : "Cancel Blacklist")}
                                </button>
                              )}
                              {canApprove(activity) && (permissions.hasApproveBlacklistPer || permissions.hasApproveFreezePer) && (
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm"
                                  onClick={() =>
                                    handleApprove(activity.id, activity.type)
                                  }
                                  disabled={loading}
                                >
                                  {activity.type === "FREEZE" && (restrictions.find((r) => r.address === activity.address)?.isFrozen ? "Approve Unfreeze" : "Approve Freeze")}
                                  {activity.type === "BLACKLIST" &&
                                    (restrictions.find((r) => r.address === activity.address)?.isBlacklisted ? "Approve Unblacklist" : "Approve Blacklist")}
                                </button>
                              )}
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {totalItems > itemsPerPage && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
};
