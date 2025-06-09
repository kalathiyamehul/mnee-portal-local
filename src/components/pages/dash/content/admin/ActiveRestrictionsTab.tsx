import { ActiveRestrictions } from "./ActiveRestrictions";
import type { AddressStatus, Activity } from "./types";
import type { MouseEvent } from "react";
import { FaSnowflake, FaBan, FaCopy } from "react-icons/fa6";
import { MdOutlineOpenInNew, MdRemoveCircleOutline } from "react-icons/md";
import { formatDistanceToNow } from "date-fns";
import type { Session } from "next-auth";
import { getGravatarUrl } from "@/utils/gravatar";
import { Pagination } from "@/components/common/Pagination";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ActiveRestrictionsTabProps {
  restrictions: AddressStatus[];
  loading: boolean;
  handleUnblacklist: (
    e: MouseEvent<HTMLButtonElement>,
    address: string
  ) => Promise<void>;
  handleBlacklist: (
    e: MouseEvent<HTMLButtonElement>,
    address: string
  ) => Promise<void>;
  handleFreezeRequest: (
    e: MouseEvent<HTMLButtonElement>,
    address: string
  ) => Promise<void>;
  handleUnfreeze: (address: string) => Promise<void>;
  showModal: (id: string) => void;
  activities: Activity[];
  handleCancel: (id: string, type: Activity["type"]) => Promise<void>;
  handleApprove: (id: string, type: Activity["type"]) => Promise<void>;
  session: Session;
  permissions: {
    hasReadBlacklistPer: boolean;
    hasCreateBlacklistPer: boolean;
    hasApproveBlacklistPer: boolean;
    hasReadFreezePer: boolean;
    hasCreateFreezePer: boolean;
    hasApproveFreezePer: boolean;
  };
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
  permissions,
}: ActiveRestrictionsTabProps) => {
  // console.log("Permissions: ", permissions);
  // Filter activities to only show restriction-related ones
  const restrictionActivities = activities
    .filter(
      (activity) =>
        (activity.type === "FREEZE" || activity.type === "BLACKLIST") &&
        activity.status !== "PENDING" // Exclude pending requests from history
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  const showActions =
    permissions.hasApproveBlacklistPer ||
    permissions.hasApproveFreezePer

  const getActionBadgeClass = (activity: Activity) => {
    if (activity.type === "BLACKLIST") {
      return "badge-error";
    }
    return "badge-info";
  };

  const getRowBorderClass = (activity: Activity) => {
    if (activity.type === "BLACKLIST") {
      return "border-l-4 border-l-error";
    }
    return "border-l-4 border-l-info";
  };

  const handleExplore = (address: string) => {
    window.open(`https://whatsonchain.com/address/${address}`, "_blank");
  };

  const canCancel = (activity: Activity) => {
    return (
      activity.status === "PENDING" &&
      activity.requester.email === session?.user?.email
    );
  };

  const canApprove = (activity: Activity) => {
    if (activity.status !== "PENDING") return false;
    if (activity.requester.email === session?.user?.email) return false;
    return !activity.approvals?.some(
      (a) => a.approver?.email === session?.user?.email
    );
  };

  const handleCopyAddress = (txid: string) => {
    navigator.clipboard.writeText(txid);
    toast.success("Address copied to clipboard");
  };

  // Helper function to check approve permission for activity type
  const hasApprovePermission = (type: string) => {
    const permissionMap: Record<string, string> = {
      MINT: "hasApproveMintPer",
      BURN: "hasApproveBurnPer",
      REFUND: "hasApproveRefundPer",
      BLACKLIST: "hasApproveBlacklistPer",
      FREEZE: "hasApproveFreezePer",
    };
    const key = permissionMap[type];
    return key ? permissions[key as keyof typeof permissions] : false;
  };

  // Pagination state for history table
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const totalItems = restrictionActivities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Reset page when activities change
  useEffect(() => {
    setCurrentPage(1);
  }, [restrictionActivities.length]);

  // Paginated activities
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentActivities = restrictionActivities.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl sm:text-2xl font-bold">Active</h2>
        {permissions.hasCreateBlacklistPer &&
          permissions.hasCreateFreezePer && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => showModal("freeze_modal")}
            >
              <FaSnowflake className="mr-1" />
              <span className="text-sm">Restrict</span>
            </button>
          )}
      </div>
      <ActiveRestrictions
        restrictions={restrictions}
        loading={loading}
        handleUnblacklist={handleUnblacklist}
        handleBlacklist={handleBlacklist}
        handleFreezeRequest={handleFreezeRequest}
        handleUnfreeze={handleUnfreeze}
        showActions={showActions}
        activities={activities}
        handleCancel={handleCancel}
        handleApprove={handleApprove}
        session={session}
        permissions={permissions}
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
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentActivities.map((activity) => (
                <tr
                  key={activity.id}
                  className={`hover ${getRowBorderClass(activity)}`}
                >
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
                        <div className="font-medium">
                          {activity.requester.email}
                        </div>
                        <div className="text-sm opacity-50">
                          {formatDistanceToNow(new Date(activity.createdAt), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-col">
                        <div className="flex gap-1">
                          <a
                            href={`https://whatsonchain.com/address/${activity.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="font-mono text-sm">
                              {activity.address}
                            </span>
                          </a>
                          <button
                            type="button"
                            onClick={() =>
                              activity.address &&
                              handleCopyAddress(activity.address)
                            }
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
                            href={`https://whatsonchain.com/address/${activity.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-link btn-xs p-0"
                          >
                            View on Explorer{" "}
                            <MdOutlineOpenInNew className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge ${getActionBadgeClass(
                            activity
                          )} badge-sm`}
                        >
                          {activity.type === "BLACKLIST"
                            ? activity.action === "BLACKLIST"
                              ? "Blacklist"
                              : "Unblacklist"
                            : activity.action === "FREEZE"
                            ? "Freeze"
                            : "Unfreeze"}
                        </span>
                        {activity.status !== "APPROVED" && (
                          <span
                            className={`badge badge-sm ${
                              activity.status === "PENDING"
                                ? "badge-warning"
                                : activity.status === "CANCELLED"
                                ? "badge-error"
                                : "badge-success"
                            }`}
                          >
                            {activity.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {showActions && (
                    <td>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        {activity.status === "PENDING" && (
                          <>
                            {canCancel(activity) && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  handleCancel(activity.id, activity.type)
                                }
                                disabled={loading}
                              >
                                {activity.type === "FREEZE" && "Cancel Freeze"}
                                {activity.type === "BLACKLIST" &&
                                  "Cancel Blacklist"}
                              </button>
                            )}
                            {canApprove(activity) &&
                              hasApprovePermission(activity.type) && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    handleApprove(activity.id, activity.type)
                                  }
                                  disabled={loading}
                                >
                                  {activity.type === "FREEZE" &&
                                    "Approve Freeze"}
                                  {activity.type === "BLACKLIST" &&
                                    "Approve Blacklist"}
                                </button>
                              )}
                          </>
                        )}
                        {activity.type === "BLACKLIST" &&
                          activity.status === "APPROVED" &&
                          permissions.hasCreateBlacklistPer &&
                          (restrictions.find(
                            (r) => r.address === activity.address
                          )?.isBlacklisted ? (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={(e) =>
                                activity.address &&
                                handleUnblacklist(e, activity.address)
                              }
                              disabled={loading}
                            >
                              <MdRemoveCircleOutline className="w-3 h-3 mr-1" />{" "}
                              Unblacklist
                            </button>
                          ) : (
                            permissions.hasCreateBlacklistPer && (
                              <button
                                type="button"
                                className="btn btn-error btn-sm"
                                onClick={(e) =>
                                  activity.address &&
                                  handleBlacklist(e, activity.address)
                                }
                                disabled={loading}
                              >
                                <FaBan className="w-3 h-3 mr-1" /> Blacklist
                              </button>
                            )
                          ))}
                        {activity.type === "FREEZE" &&
                          activity.status === "APPROVED" &&
                          permissions.hasCreateFreezePer &&
                          (restrictions.find(
                            (r) => r.address === activity.address
                          )?.isFrozen ? (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() =>
                                activity.address &&
                                handleUnfreeze(activity.address)
                              }
                              disabled={loading}
                            >
                              <FaSnowflake className="w-3 h-3 mr-1" /> Unfreeze
                            </button>
                          ) : (
                            permissions.hasCreateFreezePer && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={(e) =>
                                  activity.address &&
                                  handleFreezeRequest(e, activity.address)
                                }
                                disabled={loading}
                              >
                                <FaSnowflake className="w-3 h-3 mr-1" /> Freeze
                              </button>
                            )
                          ))}
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
      </div>
    </div>
  );
};
