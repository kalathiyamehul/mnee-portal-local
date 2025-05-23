"use client"

import { useMemo } from "react"
import DashboardHomeContent from "./content/home"
import DashboardWalletContent from "./content/wallet"
import DashboardAdminContent from "./content/admin"
import DashboardSettingsContent from './content/settings';
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

