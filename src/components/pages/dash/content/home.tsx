"use client";

import {
  FaBitcoinSign,
  FaUsers,
  FaCircleExclamation,
  FaMoneyBillTransfer,
  FaArrowRight,
} from "react-icons/fa6";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MintTable } from "./admin/MintTable";
import { BurnTable } from "./admin/BurnTable";
import { toast } from "react-hot-toast";
import type { Activity, BurnUtxo } from "./admin/types";
import { TokenActivityChart } from "@/components/charts/TokenActivityChart";
import { ActivityList } from "./admin/ActivityList";
import { getActivityIcon } from "./admin/utils";
import { useSession } from "next-auth/react";
import type { Config } from "@prisma/client";
import { toToken } from "satoshi-token";

// Utility functions
const getActivityDisplayText = (activity: Activity) => {
  switch (activity.type) {
    case "MINT":
      return `Mint to ${activity.address || "customer"}`;
    case "BURN":
      return `Burn from ${activity.address || "customer"}`;
    case "REFUND":
      return `Refund Request`;
    case "CUSTOMER":
      return `New Customer`;
    case "FREEZE":
      return activity.action === "UNFREEZE"
        ? `Unfreeze Address ${activity.address}`
        : `Freeze Address ${activity.address}`;
    case "BLACKLIST":
      return activity.action === "UNBLACKLIST"
        ? `Unblacklist Address ${activity.address}`
        : `Blacklist Address ${activity.address}`;
    case "ACTION":
      return activity.action || "Unknown Action";
    default:
      return "Unknown Activity";
  }
};

const requiresApproval = (activity: Activity) => {
  // All actions require approval
  return true;
};

const getApprovalCount = (activity: Activity) => {
  return activity.approvals?.length || 0;
};

type ChartType = "volume" | "mints" | "burns" | "customers" | "restrictions";

type DashboardMetrics = {
  totalCustomers: number;
  totalMintVolume: number;
  pendingMints: number;
  recentMints: Activity[];
  activeBlacklists: number;
  pendingBurns: number;
  recentBurns: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    outpoint: string;
    requester: {
      email: string;
      name: string | null;
    };
    approvals: Array<{
      id: string;
      approver: {
        email: string;
        name: string | null;
      };
    }>;
  }>;
};

type RequestTables = {
  recentMints: Activity[];
  recentBurns: Activity[];
  pendingActivities: Activity[];
};

interface DashboardHomeContentProps {
  initialConfig: Config;
}

// Add this import at the top with other imports
import { useSystemStatus } from "@/contexts/SystemStatusContext";
import { usePermission } from "@/hooks/usePermission";
import { Action, Resource } from "@/lib/permission";
import { apiFetch } from "@/utils/api";

const DashboardHomeContent = ({ initialConfig }: DashboardHomeContentProps) => {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [requestTables, setRequests] = useState<RequestTables | null>(null);
  const [loading, setLoading] = useState(false);
  // Add this line to access system status
  const { statusData, fetchStatus } = useSystemStatus();

  // Now you can use statusData to check recent Activities & Requestes
  useEffect(() => {
    if (statusData) {
      const allActivities: Activity[] = [
        ...statusData.freezeRequests.map((req) => ({
          ...req,
          type: "FREEZE" as const,
        })),
        ...statusData.blacklistRequests.map((req) => ({
          ...req,
          type: "BLACKLIST" as const,
        })),
        ...statusData.systemRequests.map((req) => ({
          ...req,
          type: "ACTION" as const,
        })),
        ...statusData.mintRequests.map((req) => ({
          ...req,
          type: "MINT" as const,
          action: "MINT" as const,
        })),
        ...statusData.burnRequests.map((req) => ({
          ...req,
          type: "BURN" as const,
          action: "BURN" as const,
        })),
        ...statusData.refundRequests.map((req) => ({
          ...req,
          type: "REFUND" as const,
          action: "REFUND" as const,
        })),
        ...statusData.customerRequests.map((req) => ({
          ...req,
          type: "CUSTOMER" as const,
          action: "CREATE" as const,
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      const filteredActivities = allActivities.filter((activity) => {
        switch (activity.type) {
          case "MINT":
            return hasReadMintPer;
          case "BURN":
            return hasReadBurnPer;
          case "REFUND":
            return hasReadRefundPer;
          case "BLACKLIST":
            return hasReadBlacklistPer;
          case "FREEZE":
            return hasReadFreezePer;
          case "CUSTOMER":
            return hasReadCustomerPer;
          case "ACTION":
            return hasReadActionPer;
          default:
            return false;
        }
      });
      setRequests({
        recentMints: filteredActivities
          .filter((act) => act.type === "MINT")
          .filter((activity) => activity.status === "PENDING")
          .slice(0, 5),
        recentBurns: filteredActivities
          .filter((act) => act.type === "BURN")
          .filter((activity) => activity.status === "PENDING")
          .slice(0, 5),
        pendingActivities: filteredActivities
          .filter((activity) => activity.status === "PENDING")
          .slice(0, 5),
      });
      setLoading(false);
    }
  }, [statusData]);
  const { hasPermission } = usePermission();
  const isSuperAdmin = hasPermission(Resource.SUPER_ADMIN, Action.MANAGE);
  // Mint Permissions
  const hasCreateMintPer = isSuperAdmin
    ? true
    : hasPermission(Resource.MINT, Action.CREATE) || false;
  const hasApproveMintPer = isSuperAdmin
    ? true
    : hasPermission(Resource.MINT, Action.APPROVE) || false;
  const hasRejectMintPer = isSuperAdmin
    ? true
    : hasPermission(Resource.MINT, Action.REJECT) || false;
  const hasReadMintPer = isSuperAdmin
    ? true
    : hasPermission(Resource.MINT, Action.READ) || false;

  // Burn Permissions
  const hasCreateBurnPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BURN, Action.CREATE) || false;
  const hasApproveBurnPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BURN, Action.APPROVE) || false;
  const hasRejectBurnPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BURN, Action.REJECT) || false;
  const hasReadBurnPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BURN, Action.READ) || false;

  // Refund Permissions
  const hasCreateRefundPer = isSuperAdmin
    ? true
    : hasPermission(Resource.REFUND, Action.CREATE) || false;
  const hasApproveRefundPer = isSuperAdmin
    ? true
    : hasPermission(Resource.REFUND, Action.APPROVE) || false;
  const hasReadRefundPer = isSuperAdmin
    ? true
    : hasPermission(Resource.REFUND, Action.READ) || false;

  // Blacklist Permissions
  const hasCreateBlacklistPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BLACKLIST, Action.CREATE) || false;
  const hasApproveBlacklistPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BLACKLIST, Action.APPROVE) || false;
  const hasReadBlacklistPer = isSuperAdmin
    ? true
    : hasPermission(Resource.BLACKLIST, Action.READ) || false;

  // Freeze Permissions
  const hasCreateFreezePer = isSuperAdmin
    ? true
    : hasPermission(Resource.FREEZE, Action.CREATE) || false;
  const hasApproveFreezePer = isSuperAdmin
    ? true
    : hasPermission(Resource.FREEZE, Action.APPROVE) || false;
  const hasReadFreezePer = isSuperAdmin
    ? true
    : hasPermission(Resource.FREEZE, Action.READ) || false;

  // Customers Permissions
  const hasCreateCustomerPer = isSuperAdmin
    ? true
    : hasPermission(Resource.CUSTOMER, Action.CREATE) || false;
  const hasApproveCustomerPer = isSuperAdmin
    ? true
    : hasPermission(Resource.CUSTOMER, Action.APPROVE) || false;
  const hasReadCustomerPer = isSuperAdmin
    ? true
    : hasPermission(Resource.CUSTOMER, Action.READ) || false;

  // System Actions Permissions
  const hasReadActionPer = isSuperAdmin
    ? true
    : hasPermission(Resource.SYSTEM, Action.READ) || false;

  const hasPauseActionPer = isSuperAdmin
    ? true
    : hasPermission(Resource.SYSTEM, Action.PAUSE) || false;

  const hasResumeActionPer = isSuperAdmin
    ? true
    : hasPermission(Resource.SYSTEM, Action.RESUME) || false;

  // Permissions object
  const permissions = {
    // Mint
    hasReadMintPer,
    hasApproveMintPer,
    hasRejectMintPer,
    // Burn
    hasReadBurnPer,
    hasApproveBurnPer,
    hasRejectBurnPer,
    // Refund
    hasReadRefundPer,
    hasApproveRefundPer,
    // Blacklist
    hasReadBlacklistPer,
    hasApproveBlacklistPer,
    // Freeze
    hasReadFreezePer,
    hasApproveFreezePer,
    // Customers
    hasReadCustomerPer,
    hasApproveCustomerPer,
    // System Actions
    hasReadActionPer,
    hasPauseActionPer,
    hasResumeActionPer,
  };

  // Default to 'volume' if no chart is selected
  const selectedChart = (searchParams.get("chart") || "volume") as ChartType;
  const showActions =
    hasApproveMintPer ||
    hasRejectMintPer ||
    hasApproveBurnPer ||
    hasRejectBurnPer ||
    hasApproveRefundPer ||
    hasApproveBlacklistPer ||
    hasApproveFreezePer ||
    hasApproveCustomerPer ||
    hasPauseActionPer ||
    hasResumeActionPer;

  const canCancel = useCallback(
    (activity: Activity) => {
      if (!session?.user?.email) return false;
      return (
        activity.status === "PENDING" &&
        activity.requester.email === session.user.email
      );
    },
    [session]
  );

  const canApprove = useCallback(
    (activity: Activity) => {
      if (!session?.user?.email) return false;
      if (activity.status !== "PENDING") return false;
      if (activity.requester.email === session.user.email) return false;
      return !activity.approvals?.some(
        (approval) => approval.approver?.email === session.user.email
      );
    },
    [session]
  );

  const handleCancel = async (id: string, type: Activity["type"]) => {
    try {
      const requestType = `${type.toLowerCase()}RequestId`;
      await apiFetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [requestType]: id }),
      });
      fetchMetrics();
      toast.success("Request cancelled");
    } catch (error) {
      // console.error("Error cancelling request:", error);
      toast.error("Failed to cancel request");
    }
  };

  const handleApprove = async (id: string, type: Activity["type"]) => {
    try {
      const endpoint =
        type === "ACTION"
          ? "approveSystem"
          : type === "FREEZE"
          ? "approveFreeze"
          : type === "BLACKLIST"
          ? "approveBlacklist"
          : type === "MINT"
          ? "approveMint"
          : type === "BURN"
          ? "approveBurn"
          : type === "REFUND"
          ? "approveRefund"
          : type === "CUSTOMER"
          ? "approveCustomer"
          : null;

      if (!endpoint) throw new Error("Invalid activity type");

      const requestType =
        type === "ACTION"
          ? "actionRequestId"
          : type === "FREEZE"
          ? "freezeRequestId"
          : type === "BLACKLIST"
          ? "blacklistRequestId"
          : type === "MINT"
          ? "mintRequestId"
          : type === "CUSTOMER"
          ? "customerRequestId"
          : type === "BURN"
          ? "burnRequestId"
          : type === "REFUND"
          ? "refundRequestId"
          : "refundRequestId";

      const response = await apiFetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [requestType]: id }),
      });

      if (!response.ok) {
        const { error } = await response.json();
        throw new Error(error || "Failed to approve request");
      }

      fetchMetrics();
      toast.success("Request approved");
    } catch (error) {
      // console.error("Error approving request:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve request"
      );
    }
  };

  const fetchMetrics = useCallback(() => {
    apiFetch("/api/dashboard")
      .then((response) => response.json())
      .then((data) => setMetrics(data))
      .catch((error) => {
        // console.error("Failed to fetch dashboard metrics:", error)
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to fetch dashboard metrics"
        );
      });
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (!metrics) {
    return (
      <div className="flex justify-center items-center min-h-screen animate-fade-in">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  // Format burns for the BurnTable component
  const formattedBurns: BurnUtxo[] = (metrics.recentBurns || [])
    .map((burn) => {
      const [txid, vout] = (burn.outpoint || "").split("_");
      if (!txid || !vout) return null;

      return {
        txid,
        vout: Number.parseInt(vout),
        height: 0,
        data: {
          bsv21: {
            amt: burn.amount,
          },
        },
        burnRequest: {
          id: burn.id,
          status: burn.status,
          createdAt: burn.createdAt,
          amount: burn.amount.toString(),
          requester: burn.requester,
          outpoint: burn.outpoint,
          updatedAt: burn.createdAt,
          approvals: burn.approvals,
        },
        idx: 0,
        script: "",
        outpoint: burn.id,
        satoshis: 0,
        owners: [],
      };
    })
    .filter(Boolean) as unknown as BurnUtxo[];

  const getStatCardClass = (chartType: ChartType) => {
    const baseClass =
      "stat hover:bg-base-200 transition-colors cursor-pointer bg-base-200 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:opacity-0 after:transition-opacity";
    return selectedChart === chartType
      ? `${baseClass} bg-base-300 after:opacity-100 after:bg-accent`
      : baseClass;
  };

  const getChartType = (selected: ChartType) => {
    // Map the selected type to the actual chart type
    switch (selected) {
      case "mints":
      case "burns":
        return "count";
      default:
        return selected;
    }
  };

  const handleChartSelect = (chartType: ChartType) => {
    const params = new URLSearchParams(searchParams);
    if (selectedChart === chartType) {
      // Instead of removing the param, set it back to volume
      params.set("chart", "volume");
    } else {
      params.set("chart", chartType);
    }
    router.push(`?${params.toString()}`);
  };

  const mappedBurns =
    metrics?.recentBurns.map(
      (burn) =>
        ({
          ...burn,
          type: "BURN" as const,
          action: "BURN" as const,
          address: burn.outpoint?.split("_")[0] || "",
          amount: burn.amount.toString(),
          updatedAt: burn.createdAt,
          requestedBy: burn.requester.email,
          requiresApproval: true,
        } as Activity)
    ) || [];
  return (
    <div className="p-4 space-y-8 animate-fade-in">
      <div className="stats shadow w-full">
        <div
          className={getStatCardClass("customers")}
          onClick={() => handleChartSelect("customers")}
        >
          <div className="stat-figure text-base-content/70">
            <FaUsers className="w-8 h-8" />
          </div>
          <div className="stat-title text-base-content/70">Total Customers</div>
          <div className="stat-value text-primary">
            {metrics.totalCustomers}
          </div>
          <div className="stat-desc text-base-content/60">Active users</div>
        </div>

        <div
          className={getStatCardClass("volume")}
          onClick={() => handleChartSelect("volume")}
        >
          <div className="stat-figure text-base-content/70">
            <FaBitcoinSign className="w-8 h-8" />
          </div>
          <div className="stat-title text-base-content/70">24h Mint Volume</div>
          <div className="stat-value text-primary">
            {toToken(
              metrics.totalMintVolume,
              initialConfig.decimals
            ).toLocaleString()}
          </div>
          <div className="stat-desc text-base-content/60">MNEE</div>
        </div>

        <div
          className={getStatCardClass("mints")}
          onClick={() => handleChartSelect("mints")}
        >
          <div className="stat-figure text-base-content/70">
            <FaMoneyBillTransfer className="w-8 h-8" />
          </div>
          <div className="stat-title text-base-content/70">Pending Mints</div>
          <div className="stat-value text-primary">{metrics.pendingMints}</div>
          <div className="stat-desc text-base-content/60">
            Awaiting approval
          </div>
        </div>

        <div
          className={getStatCardClass("burns")}
          onClick={() => handleChartSelect("burns")}
        >
          <div className="stat-figure text-base-content/70">
            <FaBitcoinSign className="w-8 h-8" />
          </div>
          <div className="stat-title text-base-content/70">Pending Burns</div>
          <div className="stat-value text-primary">{metrics.pendingBurns}</div>
          <div className="stat-desc text-base-content/60">
            Awaiting approval
          </div>
        </div>

        <div
          className={getStatCardClass("restrictions")}
          onClick={() => handleChartSelect("restrictions")}
        >
          <div className="stat-figure text-base-content/70">
            <FaCircleExclamation className="w-8 h-8" />
          </div>
          <div className="stat-title text-base-content/70">
            Active Restrictions
          </div>
          <div className="stat-value text-primary">
            {metrics.activeBlacklists}
          </div>
          <div className="stat-desc text-base-content/60">
            Restricted addresses
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {selectedChart === "volume" && "Mint Volume"}
            {selectedChart === "mints" && "Mint Transaction History"}
            {selectedChart === "burns" && "Burn Transaction History"}
            {selectedChart === "customers" && "Customer Growth"}
            {selectedChart === "restrictions" && "Restrictions History"}
          </h2>
          {selectedChart === "volume" && hasReadMintPer && (
            <button
              type="button"
              onClick={() => router.push("/dash/admin?tab=mints")}
              className="btn btn-ghost btn-sm gap-2"
            >
              View Mints <FaArrowRight className="w-3 h-3" />
            </button>
          )}
          {selectedChart === "mints" && hasReadMintPer && (
            <button
              type="button"
              onClick={() => router.push("/dash/admin?tab=mints")}
              className="btn btn-ghost btn-sm gap-2"
            >
              View Mints <FaArrowRight className="w-3 h-3" />
            </button>
          )}
          {selectedChart === "burns" && hasReadBurnPer && (
            <button
              type="button"
              onClick={() => router.push("/dash/admin?tab=burns")}
              className="btn btn-ghost btn-sm gap-2"
            >
              View Burns <FaArrowRight className="w-3 h-3" />
            </button>
          )}
          {selectedChart === "customers" && hasReadCustomerPer && (
            <button
              type="button"
              onClick={() => router.push("/dash/customers")}
              className="btn btn-ghost btn-sm gap-2"
            >
              View Customers <FaArrowRight className="w-3 h-3" />
            </button>
          )}
          {selectedChart === "restrictions" &&
            (hasReadFreezePer || hasReadBlacklistPer) && (
              <button
                type="button"
                onClick={() => router.push("/dash/admin?tab=restrictions")}
                className="btn btn-ghost btn-sm gap-2"
              >
                View Restrictions <FaArrowRight className="w-3 h-3" />
              </button>
            )}
        </div>
        <TokenActivityChart
          type={getChartType(selectedChart)}
          highlight={selectedChart === "burns" ? "burns" : "mints"}
          height={350}
        />
      </div>

      <div className="w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Pending Activities</h2>
          {(hasReadActionPer ||
        hasReadBlacklistPer ||
        hasReadFreezePer ||
        hasReadBurnPer ||
        hasReadMintPer ||
        hasReadRefundPer ||
        hasReadCustomerPer) && <button
            type="button"
            onClick={() => router.push("/dash/admin?tab=activity")}
            className="btn btn-ghost btn-sm gap-2"
          >
            View Activity <FaArrowRight className="w-3 h-3" />
          </button>}
        </div>
        {(hasReadActionPer ||
        hasReadBlacklistPer ||
        hasReadFreezePer ||
        hasReadBurnPer ||
        hasReadMintPer ||
        hasReadRefundPer ||
        hasReadCustomerPer) ? (
          <ActivityList
            showOnlyPending={true}
            setShowOnlyPending={() => {}}
            filteredActivities={requestTables?.pendingActivities || []}
            config={initialConfig}
            loading={loading}
            showAction={showActions}
            canCancel={canCancel}
            canApprove={canApprove}
            handleCancel={handleCancel}
            handleApprove={handleApprove}
            getActivityIcon={getActivityIcon}
            getActivityDisplayText={getActivityDisplayText}
            requiresApproval={requiresApproval}
            getApprovalCount={getApprovalCount}
            showPendingSwitch={false}
            showRequester={true}
            permissions={permissions}
          />
        ) : (
          <div className="text-center text-base-content/70 flex justify-center items-center h-24 gap-4">
            <FaCircleExclamation className="w-5 h-5" />
            <p>You do not have permission to view this tab.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="w-full">
          <MintTable
            title="Recent Mints"
            mints={requestTables?.recentMints || []}
            limit={5}
            showViewAll={true}
            onUpdate={fetchMetrics}
            showRequester={false}
            mode="all"
            hasApproveMintPer={hasApproveMintPer}
            hasRejectMintPer={hasRejectMintPer}
          />
        </div>

        <div className="w-full">
          {hasReadBurnPer && <BurnTable
            title="Recent Burns"
            burns={formattedBurns}
            decimals={initialConfig.decimals}
            onCopyTxid={(txid) => {
              navigator.clipboard.writeText(txid);
              toast.success("Transaction ID copied to clipboard");
            }}
            alwaysShow={true}
            showViewAll={true}
            showRequester={false}
            hasApproveBurnPer={hasApproveBurnPer}
            hasRejectBurnPer={hasRejectBurnPer}
            hasApproveRefundPer={hasApproveRefundPer}
          />}
        </div>
      </div>
    </div>
  );
};

export default DashboardHomeContent;
