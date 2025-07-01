import { formatDistanceToNow } from "date-fns";
import { FaCopy, FaSpinner } from "react-icons/fa6";
import { useSession } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  MdOutlineOpenInNew,
} from "react-icons/md";
import { useEffect, useState } from "react";
import { getGravatarUrl } from "@/utils/gravatar";
import { Pagination } from "@/components/common/Pagination";
import { apiFetch } from "@/utils/api";
import type { Activity } from "./types";

const statusColors: Record<string, string> = {
  PENDING: "badge-warning",
  APPROVED: "badge-success",
  REJECTED: "badge-error",
  CANCELLED: "badge-neutral",
  DONE: "badge-success",
};

interface CustomerHistoryProps {
  title?: string;
  customers: Activity[];
  limit?: number;
  showViewAll?: boolean;
  onUpdate?: () => void;
  fetchCustomers?: () => Promise<void>;
  alwaysShow?: boolean;
  showActions?: boolean;
  showRequester?: boolean;
  // Add pagination props
  itemsPerPage?: number;
  enablePagination?: boolean;
  hasApproveCustomerPer?: boolean;
  hasRejectCustomerPer?: boolean;
}

const getRowBorderClass = (status: string) => {
  switch (status) {
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

export const CustomerHistory = ({
  title,
  customers,
  limit,
  showViewAll = false,
  onUpdate,
  fetchCustomers,
  alwaysShow = false,
  showActions = true,
  showRequester = true,
  enablePagination = false,
  hasApproveCustomerPer,
  hasRejectCustomerPer,
  itemsPerPage = 6,
}: CustomerHistoryProps) => {
  const { data: session } = useSession();
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingApproval, setLoadingApproval] = useState<string | null>(null);
  const [loadingReject, setLoadingReject] = useState<string | null>(null);

  const hasUserApproved = (customer: Activity) => {
    if (!session?.user?.email) return false;
    return customer.approvals?.some(
      (approval) => approval.approver?.email === session.user.email
    );
  };

  const handleApprove = async (id: string) => {
    try {
      setLoadingApproval(id);
      const response = await apiFetch("/api/approveCustomer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerRequestId: id }),
      });

      const data = await response.json();

      if (response.status === 202) {
        // System is paused or address is frozen, show info toast
        toast(data.error || "Request will remain pending", {
          style: { background: "#3b82f6", color: "white" },
        });
        onUpdate?.();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve customer request");
      }

      if (data.success) {
        toast.success(data.message || "Request Approved");
        fetchCustomers?.();
      } else {
        throw new Error(data.error || "Failed to approve customer request");
      }
    } catch (error) {
      // console.error("Failed to approve customer request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to approve customer request"
      );
    } finally {
      setLoadingApproval(null);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await apiFetch("/api/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerRequestId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel customer request");
      }

      if (data.success) {
        toast.success("customer request cancelled");
        onUpdate?.();
      } else {
        throw new Error(data.error || "Failed to cancel customer request");
      }
    } catch (error) {
      // console.error("Failed to cancel customer request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to cancel customer request"
      );
    }
  };

  const handleReject = async (id: string) => {
    try {
      setLoadingReject(id);
      const response = await apiFetch("/api/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customerRequestId: id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reject customer request");
      }

      if (data.success) {
        toast.success(data.message || "customer request rejected");
        onUpdate?.();
      } else {
        throw new Error(data.error || "Failed to reject customer request");
      }
    } catch (error) {
      // console.error("Failed to reject customer request:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to reject customer request"
      );
    } finally {
      setLoadingReject(null);
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Apply pagination or limit
  const displaycustomers = enablePagination
    ? customers.slice(startIndex, endIndex)
    : limit
    ? customers.slice(0, limit)
    : customers;

  if (!alwaysShow && displaycustomers.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      {title && (
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr className="text-base-content/70 text-sm border-b border-base-200">
              <th className="bg-base-100">Customer</th>
              <th className="bg-base-100">MNEE Address</th>
              <th className="bg-base-100">Requested By</th>
              <th className="bg-base-100">Status</th>
              {showActions && (
                <th className="bg-base-100 w-[180px]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {customers?.map((customer) => (
              <tr
                key={customer.id}
                className="hover border-l-4 border-l-transparent hover:border-l-primary cursor-pointer"
              >
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.email)}
                          alt="Customer avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-base-content/70">
                        {customer.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm">
                        {customer.address}
                      </div>
                      <a
                        href={`https://whatsonchain.com/address/${customer.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={(e) => e.stopPropagation()}
                        title="View on WhatsOnChain"
                      >
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="avatar">
                      <div className="mask mask-squircle w-10 h-10">
                        <img
                          src={getGravatarUrl(customer.requester.email)}
                          alt="Creator avatar"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium">
                        {customer.requester.email}
                      </div>
                      <div className="text-sm text-base-content/70">
                        {formatDistanceToNow(new Date(customer.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-col gap-2">
                    <span
                      className={`badge badge-sm ${
                        statusColors[customer.status]
                      }`}
                    >
                      {customer.status}
                    </span>
                    {customer.status === "PENDING" && (
                      <span className="text-xs text-base-content/70">
                        {customer.approvals?.length || 0}/
                        {customer.no_of_approvals} Approvals
                      </span>
                    )}
                  </div>
                </td>
                {showActions && (
                  <td>
                    {hasApproveCustomerPer &&
                      customer.status === "PENDING" &&
                      session?.user && (
                        <div className="flex gap-2">
                          {customer.requester.email === session.user.email ? (
                            <button
                              type="button"
                              onClick={() => handleCancel(customer.id)}
                              className="btn btn-ghost btn-xs"
                              disabled={loadingApproval === customer.id}
                            >
                              Cancel
                            </button>
                          ) : (
                            <div className="flex gap-2 items-center">
                              {hasApproveCustomerPer && (
                                <button
                                  type="button"
                                  onClick={() => handleApprove(customer.id)}
                                  className="btn btn-primary btn-xs"
                                  disabled={
                                    loadingApproval === customer.id ||
                                    hasUserApproved(customer)
                                  }
                                >
                                  {loadingApproval === customer.id ? (
                                    <>
                                      <FaSpinner className="animate-spin mr-1" />
                                      Approving...
                                    </>
                                  ) : hasUserApproved(customer) ? (
                                    "Approved"
                                  ) : (
                                    "Approve"
                                  )}
                                </button>
                              )}
                              {hasRejectCustomerPer &&
                                !hasUserApproved(customer) && (
                                  <button
                                    type="button"
                                    className="btn btn-error btn-xs"
                                    disabled={loadingApproval === customer.id}
                                  >
                                    {loadingReject === customer.id ? (
                                      <>
                                        <FaSpinner className="animate-spin mr-1" />
                                        Rejecting...
                                      </>
                                    ) : (
                                      "Reject"
                                    )}
                                  </button>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                  </td>
                )}
              </tr>
            ))}
            {!customers?.length && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center py-4 text-base-content/70"
                >
                  No customer requests found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* pagination controls */}
      {enablePagination && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={customers.length}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
