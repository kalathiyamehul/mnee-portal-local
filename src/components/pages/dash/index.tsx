"use client"

import { useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import DashboardHomeContent from "./content/home";
import DashboardWalletContent from "./content/wallet";
import DashboardAdminContent from "./content/admin";
import DashboardSettingsContent from "./content/settings";
import DashboardCustomersContent from "./content/customers";
import DashboardTransactionsContent from "./content/transactions";
import DashboardSuperAdminContent from "./content/super-admin";
import DashboardActivityContent from "./content/activity";
import { Config } from "@prisma/client";
import type { DashPage } from "@/types/dashboard";
import { DashPages } from "@/types/dashboard";

export type DashboardProps = {
  page: DashPage;
  defaultTab?: string;
  defaultShowTransfer?: boolean;
  defaultAddress?: string;
  config?: Config;
  activityLogs?: any[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

const Dashboard: React.FC<DashboardProps> = ({
  page,
  defaultTab,
  defaultShowTransfer,
  defaultAddress,
  config,
  activityLogs,
  pagination,
}) => {
  const { data: session } = useSession();

  // Function to check for stuck transactions
  const checkStuckTransactions = async () => {
    try {
      const response = await fetch("/api/cron/mint-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.results) {
          const { total } = data.results;
          if (total.success > 0 || total.failed > 0) {
            // console.log(
            //   `🔄 Stuck transaction check completed: ${total.success} completed, ${total.failed} failed, ${total.pending} still pending`
            // );
            // console.log(
            //   `📊 Mint: ${data.results.mint.success} success, ${data.results.mint.failed} failed, ${data.results.mint.pending} pending`
            // );
            // console.log(
            //   `📊 Burn: ${data.results.burn.success} success, ${data.results.burn.failed} failed, ${data.results.burn.pending} pending`
            // );
          }
        }
      }
    } catch (error) {
      console.error("Error checking stuck transactions:", error);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;

    const eventSource = new EventSource("/api/sse");

    const handleUserSessionInvalidate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { userIds, reason, roleName, userEmail } = data;

        // Check if current user is affected
        if (userIds.includes(session.user.id)) {
          let message = "Your session has been invalidated.";

          switch (reason) {
            case "role_updated":
              message = `Your role "${roleName}" has been updated. Please log in again.`;
              break;
            case "role_assigned":
              message = `Your role has been changed to "${roleName}". Please log in again.`;
              break;
            case "role_deleted":
              message = `Your role "${roleName}" has been deleted. Please log in again.`;
              break;
            case "password_changed":
              message = `Your password has been changed. All sessions have been terminated for security.`;
              break;
            case "user_deleted":
              message = `Your account has been deleted. You will be logged out immediately.`;
              break;
          }

          toast.error(message);

          // Sign out the user after a short delay
          setTimeout(() => {
            signOut({ callbackUrl: "/login" });
          }, 2000);
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.addEventListener(
      "userSessionInvalidate",
      handleUserSessionInvalidate
    );

    eventSource.onerror = (error) => {
      // console.error("SSE connection error:", error);
      eventSource.close();
    };

    return () => {
      eventSource.removeEventListener(
        "userSessionInvalidate",
        handleUserSessionInvalidate
      );
      eventSource.close();
    };
  }, [session?.user?.id]);

  // Set up interval to check for stuck transactions every 5 minutes
  useEffect(() => {
    if (!session?.user?.id) return;

    // Initial check after 30 seconds
    const initialTimeout = setTimeout(() => {
      checkStuckTransactions();
    }, 15000);

    // Set up interval for every 5 minutes (300000 ms)
    const interval = setInterval(() => {
      checkStuckTransactions();
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [session?.user?.id]);

  const dashContent = useMemo(() => {
    switch (page) {
      case DashPages.HOME:
        return <DashboardHomeContent initialConfig={config as Config} />;
      case DashPages.ADMIN:
        return <DashboardAdminContent defaultTab={defaultTab} />;
      case DashPages.WALLET:
        return (
          <DashboardWalletContent
            defaultShowTransfer={defaultShowTransfer}
            defaultAddress={defaultAddress}
          />
        );
      case DashPages.SETTINGS:
        return <DashboardSettingsContent />;
      case DashPages.CUSTOMERS:
        return <DashboardCustomersContent />;
      case DashPages.TRANSACTIONS:
        return <DashboardTransactionsContent />;
      case DashPages.SUPER_ADMIN:
        return (
          <DashboardSuperAdminContent defaultTab={defaultTab || "roles"} />
        );
      case DashPages.ACTIVITY:
        return (
          <DashboardActivityContent
            initialActivityLogs={activityLogs || []}
            initialPagination={
              pagination || { total: 0, page: 1, limit: 10, totalPages: 0 }
            }
          />
        );
      default:
        return <div>Not Found</div>;
    }
  }, [
    config,
    page,
    defaultTab,
    defaultShowTransfer,
    defaultAddress,
    activityLogs,
    pagination,
  ]);

  return <div className="container px-6 py-2 mx-auto">{dashContent}</div>;
};

export default Dashboard;

