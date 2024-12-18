"use client"

import { useMemo } from "react"
import DashboardHomeContent from "./content/home"
import DashboardWalletContent from "./content/wallet"
import DashboardAdminContent from "./content/admin"
import DashboardSettingsContent from './content/settings';
import DashboardCustomersContent from "./content/customers";
import { Config } from "@prisma/client"
import type { DashPage } from "@/types/dashboard"
import { DashPages } from "@/types/dashboard"

export type DashboardProps = {
    page: DashPage;
    defaultTab?: string;
    defaultShowTransfer?: boolean;
    defaultAddress?: string;
    config?: Config;
}

const Dashboard: React.FC<DashboardProps> = ({ page, defaultTab, defaultShowTransfer, defaultAddress, config }) => {
    console.log('Dashboard page prop:', page);
    console.log('Dashboard page type:', typeof page);

    const dashContent = useMemo(() => {
        switch (page) {
            case DashPages.HOME:
                return <DashboardHomeContent initialConfig={config as Config} />
            case DashPages.ADMIN:
                return <DashboardAdminContent defaultTab={defaultTab} />
            case DashPages.WALLET:
                return <DashboardWalletContent defaultShowTransfer={defaultShowTransfer} defaultAddress={defaultAddress} />
            case DashPages.SETTINGS:
                return <DashboardSettingsContent />
            case DashPages.CUSTOMERS:
                return <DashboardCustomersContent />
            default:
                console.log('Hit default case with page:', page);
                return <div>Not Found</div>
        }
    }, [config, page, defaultTab, defaultShowTransfer, defaultAddress])

    return <div className="container px-6 py-2 mx-auto">
        {dashContent}
    </div>
}

export default Dashboard;

