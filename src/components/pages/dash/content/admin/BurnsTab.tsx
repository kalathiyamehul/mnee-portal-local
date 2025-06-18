import { useEffect, useState, useCallback } from "react";
import { apiFetch, fetchMneeUtxos } from "@/utils/api";
import {
  FaSpinner,
  FaFire,
  FaCopy,
  FaArrowsRotate,
  FaCircleInfo,
} from "react-icons/fa6";
import { toToken } from "satoshi-token";
import type { MNEEUtxo } from "@/types";
import { MdOutlineOpenInNew } from "react-icons/md";
import type { Activity, BurnUtxo } from "./types";
import { DEFAULT_DECIMALS } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { BurnModal } from "../modals/BurnModal";
import { RefundModal } from "../modals/RefundModal";
import { toast } from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { BurnTable } from "./BurnTable";
import { usePermission } from "@/hooks/usePermission";
import { Action, Resource } from "@/lib/permission";
import { Pagination } from "@/components/common/Pagination";
import { RefundRequest } from "@prisma/client";
import { RefundTable } from "./RefundTable";

const getRowBorderClass = (status: string | undefined) => {
  switch (status) {
    case "PENDING":
      return "border-l-4 border-l-warning";
    case "APPROVED":
      return "border-l-4 border-l-success";
    case "SETTLED":
      return "border-l-4 border-l-success";
    case "REFUNDED":
      return "border-l-4 border-l-info";
    case "CANCELLED":
      return "border-l-4 border-l-error";
    default:
      return "border-l-4 border-l-secondary";
  }
};

interface BurnsTabProps {
  hasCreateBurnPer?: boolean;
  hasApproveBurnPer?: boolean;
  hasRejectBurnPer?: boolean;
  hasCreateRefundPer?: boolean;
  hasApproveRefundPer?: boolean;
  hasRejectRefundPer?: boolean;
  hasSettleBurnPer?: boolean;
}

export const BurnsTab = ({
  hasApproveBurnPer,
  hasRejectBurnPer,
  hasCreateBurnPer,
  hasApproveRefundPer,
  hasCreateRefundPer,
  hasRejectRefundPer,
  hasSettleBurnPer,
}: BurnsTabProps) => {
  const { data: session } = useSession();
  const { statusData } = useSystemStatus();
  const [burns, setBurns] = useState<BurnUtxo[]>([]);
  const [refunds, setRefunds] = useState<Activity[]>([]);
  const [burnUtxos, setBurnUtxos] = useState<MNEEUtxo[]>([]);
  const [utxos, setUtxos] = useState<MNEEUtxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [burnAddress, setBurnAddress] = useState<string | null>(null);
  const [decimals, setDecimals] = useState(8);
  const [selectedBurn, setSelectedBurn] = useState<BurnUtxo | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<BurnUtxo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // console.log("Permissions: ", hasCreateBurnPer, hasApproveBurnPer, hasRejectBurnPer, hasCreateRefundPer);

  const fetchBurnAddressFromConfig = useCallback(async () => {
    try {
      const configResponse = await apiFetch("/api/config");
      const config = await configResponse.json();
      if (!config?.burnAddress) {
        throw new Error("Burn address not configured");
      }

      // console.log('Config loaded:', { config, decimals: config.decimals });
      setBurnAddress(config.burnAddress);
      setDecimals(config.decimals ?? DEFAULT_DECIMALS);
      return config.burnAddress as string;
    } catch (err) {
      // console.error("Error fetching config:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to fetch config"
      );
      setError(err instanceof Error ? err.message : "Failed to fetch config");
      return null;
    }
  }, []);

  const fetchUtxos = useCallback(async (address: string) => {
    try {
      // defaults to transfer and deploy+mint if not specified
      const fetchedTransferUtxos = await fetchMneeUtxos([address]);
      // console.log('Transfer UTXOs:', fetchedTransferUtxos);
      setUtxos(fetchedTransferUtxos);

      // burns only
      const fetchedBurnUtxos = await fetchMneeUtxos([address], ["burn"]);
      // console.log('Burn UTXOs:', fetchedBurnUtxos);
      setBurnUtxos(fetchedBurnUtxos);
    } catch (err) {
      // console.error("Error fetching UTXOs:", err);
      toast.error(err instanceof Error ? err.message : "Failed to fetch UTXOs");
      setError(err instanceof Error ? err.message : "Failed to fetch UTXOs");
    }
  }, []);

  // update burns with requests
  const updateBurns = useCallback(() => {
    // console.log('Updating burns with:', {
    //   utxos,
    //   burnUtxos,
    //   burnRequests: statusData?.burnRequests
    // });

    // Only use transfer UTXOs for burn requests
    const burnsWithRequests = utxos.map((utxo) => ({
      ...utxo,
      burnRequest: statusData?.burnRequests?.find(
        (req) => req.outpoint === `${utxo.txid}_${utxo.vout}`
      ),
      refundRequest: statusData?.refundRequests?.find(
        (req) => req.outpoint === `${utxo.txid}_${utxo.vout}`
      ),
    }));

    // console.log({ burnsWithRequests });
    // Add burn UTXOs with APPROVED status
    const completedBurnRequests = statusData?.burnRequests || [];
    const completedRefundRequests = statusData?.refundRequests || [];
    setRefunds(completedRefundRequests);
    for (const utxo of burnUtxos) {
      const outpoint = `${utxo.txid}_${utxo.vout}`;
      const existingRequest = completedBurnRequests.find(
        (req) => req.txid && outpoint.startsWith(req.txid)
      );
      const existingRefundRequest = completedRefundRequests.find(
        (req) => req.txid && outpoint.startsWith(req.txid)
      );

      burnsWithRequests.push({
        ...utxo,
        burnRequest: existingRequest,
        refundRequest: existingRefundRequest,
      });
    }

    // console.log('Final burns:', burnsWithRequests);
    setBurns(burnsWithRequests as BurnUtxo[]);
  }, [utxos, burnUtxos, statusData?.burnRequests, statusData?.refundRequests]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const address = await fetchBurnAddressFromConfig();
    if (address) {
      await fetchUtxos(address);
    }
    setLoading(false);
  }, [fetchUtxos, fetchBurnAddressFromConfig]);

  const handleCreateBurnRequest = (burn: BurnUtxo) => {
    setSelectedBurn(burn);
  };

  const handleBurnSuccess = () => {
    setSelectedBurn(null);
  };

  const handleCancel = async (request: {
    id: string;
    type: "burn" | "refund";
  }) => {
    try {
      const response = await apiFetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          request.type === "burn"
            ? { burnRequestId: request.id }
            : { refundRequestId: request.id }
        ),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || `Failed to cancel ${request.type} request`
        );
      }

      toast.success(
        `${request.type === "burn" ? "Burn" : "Refund"} request cancelled`
      );
    } catch (err) {
      // console.error(`Error cancelling ${request.type}:`, err);
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to cancel ${request.type} request`
      );
    }
  };

  const handleApproveRefund = async (refundId: string) => {
    try {
      const response = await apiFetch("/api/approveRefund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundRequestId: refundId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve refund request");
      }

      toast.success("Refund request approved");
    } catch (error) {
      // console.error("Error approving refund:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to approve refund request"
      );
    }
  };

  const handleApproveBurn = async (burnId: string) => {
    try {
      const response = await apiFetch("/api/approveBurn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ burnRequestId: burnId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to approve burn request");
      }

      toast.success("Burn request approved");
    } catch (error) {
      // console.error("Error approving burn:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to approve burn request"
      );
    }
  };

  const canCancel = (burn: BurnUtxo) => {
    if (!burn.burnRequest || !session?.user?.email) return false;
    return (
      burn.burnRequest.status === "PENDING" &&
      burn.burnRequest.requester.email === session.user.email
    );
  };

  const canCancelRefund = (burn: BurnUtxo) => {
    if (!burn.refundRequest || !session?.user?.email) return false;
    return (
      burn.refundRequest.status === "PENDING" &&
      burn.refundRequest.requester.email === session.user.email
    );
  };

  const canApproveBurn = (burn: BurnUtxo) => {
    if (!burn.burnRequest || !session?.user?.email) return false;
    return (
      burn.burnRequest.status === "PENDING" &&
      burn.burnRequest.requester.email !== session.user.email &&
      !burn.burnRequest.approvals.some(
        (approval) => approval.approver?.email === session.user.email
      )
    );
  };

  const canRejectBurn = (burn: BurnUtxo) => {
    if (!burn.burnRequest || !session?.user?.email) return false;
    return (
      burn.burnRequest.status === "PENDING" &&
      burn.burnRequest.requester.email !== session.user.email &&
      !burn.burnRequest.approvals.some(
        (approval) => approval.approver?.email === session.user.email
      )
    );
  };

  const canApproveRefund = (burn: BurnUtxo) => {
    if (!burn.refundRequest || !session?.user?.email) return false;
    return (
      burn.refundRequest.status === "PENDING" &&
      burn.refundRequest.requester.email !== session.user.email &&
      !burn.refundRequest.approvals.some(
        (approval) => approval.approver?.email === session.user.email
      )
    );
  };

  const handleRefundSuccess = () => {
    setSelectedRefund(null);
    handleRefresh();
    toast.success("Refund initiated successfully");
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard");
  };

  const handleCopyTxid = (txid: string) => {
    navigator.clipboard.writeText(txid);
    toast.success("Transaction ID copied to clipboard");
  };

  // Initial fetch of config and UTXOs
  useEffect(() => {
    if (!burnAddress) {
      handleRefresh();
    }
  }, [burnAddress, handleRefresh]);

  // Update burns when status or UTXOs change
  useEffect(() => {
    // console.log('Updating burns with decimals:', decimals);
    updateBurns();
  }, [updateBurns, decimals]);

  // Split burns into pending/active and completed
  const activeBurns = burns.filter(
    (burn) =>
      burn?.data?.bsv21?.op !== "burn" &&
      (!burn.burnRequest ||
        ["PENDING", "CANCELLED"].includes(burn.burnRequest.status))
  );
  const completedBurns = burns.filter(
    (burn) =>
      burn.burnRequest &&
      ["APPROVED", "REFUNDED", "SETTLED"].includes(burn.burnRequest.status)
  );

  const refundsHistory = refunds.filter((refund) => {
    return (
      refund &&
      ["DONE", "APPROVED", "REFUNDED", "SETTLED"].includes(refund.status)
    );
  });

  console.log("Refund History:", refundsHistory);

  const totalItems = activeBurns.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Reset page when activeBurns change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeBurns.length]);

  console.log("All Burns and Refund:", burns);

  // Paginated burns
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBurns = activeBurns.slice(indexOfFirstItem, indexOfLastItem);

  const showActions =
    hasApproveBurnPer ||
    hasRejectBurnPer ||
    hasApproveRefundPer ||
    hasRejectRefundPer;

  return (
    <div className="p-4 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Burn Requests</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-4 space-y-8">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          {decimals === 0 && (
            <div className="alert alert-warning">
              <span>Warning: Token decimals not properly configured</span>
            </div>
          )}

          <div className="bg-base-100 rounded-lg flex justify-between">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Status</th>
                    {showActions && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentBurns.map((burn) => (
                    <tr
                      key={`${burn.txid}_${burn.vout}_${
                        burn.burnRequest?.id || "new"
                      }_${burn.burnRequest?.createdAt || Date.now()}`}
                      className={`hover ${getRowBorderClass(
                        burn.burnRequest?.status
                      )}`}
                    >
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {burn.txid.slice(0, 8)}...{burn.txid.slice(-8)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyTxid(burn.txid)}
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
                            href={`https://whatsonchain.com/tx/${burn.txid}?tab=m8eqcrbs`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-link btn-xs p-0"
                          >
                            View on Explorer{" "}
                            <MdOutlineOpenInNew className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="font-medium">
                        {toToken(burn.data.bsv21.amt, decimals)} MNEE
                      </td>
                      <td className="text-sm text-base-content/70">
                        {burn.burnRequest?.createdAt
                          ? formatDistanceToNow(
                              new Date(burn.burnRequest.createdAt),
                              { addSuffix: true }
                            )
                          : `Block ${burn.height}`}
                      </td>
                      <td>
                        {burn.burnRequest ? (
                          <span
                            className={`badge ${
                              burn.burnRequest.status === "APPROVED"
                                ? "badge-success"
                                : burn.burnRequest.status === "REFUNDED"
                                ? "badge-info"
                                : burn.burnRequest.status === "PENDING"
                                ? "badge-ghost"
                                : burn.burnRequest.status === "CANCELLED"
                                ? "badge-secondary"
                                : "badge-warning"
                            } badge-sm`}
                          >
                            {burn.burnRequest.status === "CANCELLED"
                              ? "AVAILABLE"
                              : burn.burnRequest.status}
                          </span>
                        ) : (
                          <span className="badge badge-secondary badge-sm animate-pulse">
                            NEW
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          {/* Show Burn button only if no pending requests */}
                          {(!burn.burnRequest ||
                            burn.burnRequest.status === "CANCELLED") &&
                            (!burn.refundRequest?.status ||
                              burn.refundRequest?.status === "CANCELLED") &&
                            hasCreateBurnPer && (
                              <button
                                type="button"
                                onClick={() => handleCreateBurnRequest(burn)}
                                className="btn btn-error btn-sm gap-1"
                              >
                                <FaFire className="w-3 h-3" /> Burn
                              </button>
                            )}

                          {/* Cancel Burn button */}
                          {canCancel(burn) && (
                            <button
                              type="button"
                              onClick={() =>
                                burn.burnRequest &&
                                handleCancel({
                                  id: burn.burnRequest.id,
                                  type: "burn",
                                })
                              }
                              className="btn btn-ghost btn-sm"
                            >
                              Cancel Burn
                            </button>
                          )}

                          {/* Cancel Refund button */}
                          {canCancelRefund(burn) && (
                            <button
                              type="button"
                              onClick={() =>
                                burn.refundRequest &&
                                handleCancel({
                                  id: burn.refundRequest.id,
                                  type: "refund",
                                })
                              }
                              className="btn btn-ghost btn-sm"
                            >
                              Cancel Refund
                            </button>
                          )}

                          {/* Approve Burn button */}
                          {canApproveBurn(burn) &&
                            !burn.refundRequest?.status &&
                            hasApproveBurnPer && (
                              <button
                                type="button"
                                onClick={() =>
                                  burn.burnRequest &&
                                  handleApproveBurn(burn.burnRequest.id)
                                }
                                className="btn btn-success btn-sm"
                              >
                                Approve Burn
                              </button>
                            )}

                          {/* Reject Burn button */}
                          {canRejectBurn(burn) &&
                            !burn.refundRequest?.status &&
                            hasRejectBurnPer && (
                              <button
                                type="button"
                                onClick={() =>
                                  burn.burnRequest &&
                                  handleApproveRefund(burn.burnRequest.id)
                                }
                                className="btn btn-error btn-sm"
                              >
                                Reject Burn
                              </button>
                            )}

                          {/* Refund button - only show if no pending requests */}
                          {(!burn.refundRequest ||
                            !["DONE", "PENDING"].includes(
                              burn.refundRequest?.status
                            )) &&
                            (!burn.burnRequest ||
                              !["APPROVED", "REFUNDED", "PENDING"].includes(
                                burn.burnRequest?.status
                              )) &&
                            hasCreateRefundPer && (
                              <button
                                type="button"
                                onClick={() => setSelectedRefund(burn)}
                                className="btn btn-primary btn-sm gap-1"
                                disabled={
                                  burn.burnRequest?.status === "PENDING"
                                }
                                title={
                                  burn.burnRequest?.status === "PENDING"
                                    ? "Cancel burn request first"
                                    : undefined
                                }
                              >
                                Refund
                              </button>
                            )}

                          {/* Approve Refund button */}
                          {canApproveRefund(burn) && hasApproveRefundPer && (
                            <button
                              type="button"
                              onClick={() =>
                                burn.refundRequest &&
                                handleApproveRefund(burn.refundRequest.id)
                              }
                              className="btn btn-success btn-sm"
                            >
                              Approve Refund
                            </button>
                          )}
                          {/* SETTLED Button */}
                          {burn.burnRequest?.status === "APPROVED" &&
                            hasSettleBurnPer && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                              >
                                Settle
                              </button>
                            )}
                        </div>
                      </td>
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
            {burnAddress && (
              <div className="lg:col-span-1">
                <div className="bg-base-200 rounded-lg p-6 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs uppercase tracking-wider opacity-50">
                        Burn Address
                      </div>
                      <div className="text-xs text-base-content/70 flex items-center gap-2 mt-1">
                        <FaCircleInfo className="w-3 h-3" />
                        <span>Send tokens to burn</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopyAddress(burnAddress)}
                        className="btn btn-ghost btn-xs btn-square"
                        title="Copy address"
                      >
                        <FaCopy className="w-3 h-3" />
                      </button>
                      <a
                        href={`https://whatsonchain.com/address/${burnAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-xs btn-square"
                        title="View on WhatsOnChain"
                      >
                        <MdOutlineOpenInNew className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="btn btn-ghost btn-xs btn-square"
                        title="Refresh outputs"
                      >
                        {loading ? (
                          <FaSpinner className="w-3 h-3 animate-spin" />
                        ) : (
                          <FaArrowsRotate className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="font-mono text-xs break-all">
                    {burnAddress}
                  </div>

                  <div className="divider my-2" />

                  <div>
                    <div className="text-xs uppercase tracking-wider opacity-50 mb-2">
                      Current Balance
                    </div>
                    <div className="text-2xl font-bold">
                      {loading ? (
                        <span className="loading loading-spinner loading-sm" />
                      ) : (
                        `${toToken(
                          utxos
                            .reduce(
                              (total, utxo) =>
                                total + Number(utxo.data.bsv21.amt),
                              0
                            )
                            .toString(),
                          decimals
                        )} MNEE`
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <BurnTable
            title="Burn History"
            burns={completedBurns}
            decimals={decimals}
            onCopyTxid={handleCopyTxid}
            showActions={showActions}
            alwaysShow={true}
            hasApproveBurnPer={hasApproveBurnPer}
            hasRejectBurnPer={hasRejectBurnPer}
            hasSettleBurnPer={hasSettleBurnPer}
          />
          <RefundTable
            title="Refund History"
            refunds={refundsHistory}
            decimals={decimals}
            onCopyTxid={handleCopyTxid}
            alwaysShow={true}
          />
        </div>
      </div>

      {selectedBurn && (
        <BurnModal
          onClose={() => setSelectedBurn(null)}
          onSuccess={handleBurnSuccess}
          amount={selectedBurn.data.bsv21.amt}
          utxo={{
            txid: selectedBurn.txid,
            vout: selectedBurn.vout,
          }}
          decimals={decimals}
        />
      )}

      {selectedRefund && (
        <RefundModal
          onClose={() => setSelectedRefund(null)}
          onSuccess={handleRefundSuccess}
          utxo={{
            txid: selectedRefund.txid,
            vout: selectedRefund.vout,
          }}
          amount={selectedRefund.data.bsv21.amt}
          decimals={decimals}
        />
      )}
    </div>
  );
};
