"use client";

import { toToken } from "satoshi-token";
import { DEFAULT_DECIMALS } from "@/lib/constants";
import type { Activity, ActivityListProps } from "./types";
import { formatDistanceToNow } from "date-fns";
import { getGravatarUrl } from "@/utils/gravatar";
import { Pagination } from "@/components/common/Pagination";
import { useEffect, useState } from "react";
import { ExportButtons } from "@/components/common/ExportButtons";
import { usePathname } from "next/navigation";
import { MdOutlineOpenInNew } from "react-icons/md";

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
  showPendingSwitch = true,
  showRequester = true,
  permissions,
}: Omit<ActivityListProps, "session">) => {
  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Increased from 4 to show more items per page
  // console.log("permissions: ", permissions)
  // Calculate pagination values
  const totalItems = filteredActivities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Reset page when filtered activities change
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredActivities.length]);

  const path = usePathname();

  // Calculate paginated activities
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentActivities = filteredActivities.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  // console.log("permissions", permissions)

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

  // Helper to format data for export
  const exportData = filteredActivities.map((activity, index) => ({
    "": index + 1,
    Activity: getActivityDisplayText(activity),
    Details: activity.customer
      ? "Customer : " + activity.customer.name + " - " + activity.customer.email
      : "Address: " + activity.address,
    Requested_by: activity.requester.name || activity.requester.email,
    Status: activity.status,
    Approver: activity.approvals?.map((a) => a.approver?.email).join(", "),
    Created: new Date(activity.createdAt).toLocaleString(),
  }));

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "PENDING":
        return "badge-warning";
      case "APPROVED":
      case "DONE":
        return "badge-success";
      case "REJECTED":
      case "CANCELLED":
        return "badge-error";
      default:
        return "badge-ghost";
    }
  };

  const getRowBorderClass = (activity: Activity) => {
    switch (activity.status) {
      case "PENDING":
        return "border-l-4 border-l-warning";
      case "APPROVED":
      case "DONE":
        return "border-l-4 border-l-success";
      case "REJECTED":
      case "CANCELLED":
        return "border-l-4 border-l-error";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      {showPendingSwitch && (
        <div className="flex flex-wrap items-center gap-2 mb-4 justify-end">
          <label className="label cursor-pointer gap-2 px-2">
            <span className="label-text text-sm mr-2">Pending Only</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm sm:toggle-md"
              checked={showOnlyPending}
              onChange={(e) => setShowOnlyPending(e.target.checked)}
              disabled={loading}
            />
          </label>
        </div>
      )}

      <div className="w-full">
        {" "}
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <>
            {path === "/dash/admin" && (
              <ExportButtons
                data={exportData}
                filename={`Activity-list`}
                className="mb-4"
              />
            )}
            <table className="table min-w-full">
              <thead>
                <tr>
                  <th className="w-[25%]">Activity</th>
                  <th className="w-[30%]">Details</th>
                  {showRequester && <th className="w-[20%]">Requested By</th>}
                  <th className="w-[15%]">Status</th>
                  <th className="w-[10%]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentActivities.map((activity) => {
                  // Changed from filteredActivities to currentActivities
                  const Icon = getActivityIcon(activity);
                  const displayText = getActivityDisplayText(activity);
                  const needsApproval = requiresApproval(activity);
                  const approvalCount = getApprovalCount(activity);
                  const otherApprovals =
                    activity.approvals?.filter(
                      (approval) =>
                        approval.approver?.email !== activity.requester.email
                    ) || [];

                  return (
                    <tr
                      key={activity.id}
                      className={getRowBorderClass(activity)}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <Icon
                            className={
                              activity.type === "BURN"
                                ? "text-red-500 w-4 h-4"
                                : "w-4 h-4"
                            }
                          />
                          <div className="flex flex-col gap-1">
                            <div>{displayText}</div>
                            {(activity.type === "MINT" ||
                              activity.type === "BURN") && (
                              <div className="text-sm font-mono">
                                {toToken(
                                  activity.amount as string,
                                  config?.decimals || DEFAULT_DECIMALS
                                )}{" "}
                                MNEE
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {activity.customer && (
                            <>
                              <div className="text-sm">
                                <span className="opacity-70">Customer:</span>{" "}
                                {activity.customer.name}
                              </div>
                              <div className="text-sm opacity-70">
                                {activity.customer.email}
                              </div>
                            </>
                          )}
                          {(activity.type === "FREEZE" ||
                            activity.type === "BLACKLIST" ||
                            (activity.type === "MINT" && !activity.customer)) &&
                            activity.address && (
                              <div className="text-sm font-mono">
                                <span className="opacity-70">Address:</span>{" "}
                                {activity.address}
                              </div>
                            )}
                          {activity.type === "BURN" && activity.outpoint && (
                            <div className="text-sm font-mono">
                              <span className="opacity-70">Outpoint:</span>{" "}
                              <a
                                href={(() => {
                                  const vout = Number.parseInt(
                                    activity.outpoint.split("_")[1],
                                    10
                                  );
                                  const outputOffset =
                                    Math.floor(vout / 10) * 10;
                                  return `https://whatsonchain.com/tx/${
                                    activity.outpoint.split("_")[0]
                                  }?limit=10&output=${vout}&outputOffset=${outputOffset}&tab=m8eqcrbs`;
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                                title={activity.outpoint}
                              >
                                {activity.outpoint.split("_")[0].slice(0, 8)}...
                                {activity.outpoint.split("_")[0].slice(-8)}_
                                {activity.outpoint.split("_")[1]}
                              </a>
                            </div>
                          )}
                          <div
                            className="tooltip tooltip-bottom "
                            data-tip="Verify on WhatsOnChain"
                          >
                            <a
                              href={`https://whatsonchain.com/address/${activity.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-link btn-xs px-0"
                            >
                              View on Explorer{" "}
                              <MdOutlineOpenInNew className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>
                      {showRequester && (
                        <td>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="avatar">
                                <div className="mask mask-squircle w-6 h-6">
                                  <img
                                    src={getGravatarUrl(
                                      activity.requester.email
                                    )}
                                    alt="Requester avatar"
                                  />
                                </div>
                              </div>
                              <span className="text-sm">
                                {activity.requester.name ||
                                  activity.requester.email}
                              </span>
                            </div>
                            {otherApprovals.length > 0 && (
                              <div className="text-xs opacity-70">
                                Approved by:{" "}
                                {otherApprovals
                                  .map(
                                    (a) => a.approver?.name || a.approver?.email
                                  )
                                  .join(", ")}
                              </div>
                            )}
                            <div className="text-xs opacity-70">
                              {formatDistanceToNow(
                                new Date(activity.createdAt),
                                { addSuffix: true }
                              )}
                            </div>
                            {activity.status === "APPROVED" &&
                              activity.updatedAt && (
                                <div className="text-xs opacity-70">
                                  Approved{" "}
                                  {formatDistanceToNow(
                                    new Date(activity.updatedAt),
                                    { addSuffix: true }
                                  )}
                                </div>
                              )}
                          </div>
                        </td>
                      )}
                      <td>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`badge ${getStatusBadgeClass(
                              activity.status
                            )}`}
                          >
                            {activity.status}
                          </span>
                          {activity.status === "PENDING" && needsApproval && (
                            <span className="text-xs opacity-70">
                              {activity.approvals?.length || 0}/{activity.no_of_approvals}{" "}
                              Approvals
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          {canCancel(activity) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() =>
                                handleCancel(activity.id, activity.type)
                              }
                            >
                              Cancel
                            </button>
                          )}
                          {canApprove(activity) && hasApprovePermission(activity.type) && (
                            <div className="flex gap-2 items-center">
                              <button
                                type="button"
                                className="btn btn-primary btn-xs"
                                onClick={() =>
                                  handleApprove(activity.id, activity.type)
                                }
                              >
                                Approve
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {totalItems > itemsPerPage && ( // Only show pagination if there are more items than per page limit
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={totalItems}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
