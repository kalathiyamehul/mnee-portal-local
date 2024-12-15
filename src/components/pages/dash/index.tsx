"use client"

import { useMemo } from "react"
import DashboardHomeContent from "./content/home"
import DashboardWalletContent from "./content/wallet"
import DashboardAdminContent from "./content/admin"
import DashboardSettingsContent from './content/settings';
import DashboardCustomersContent from "./content/customers";
import { Config } from "@prisma/client"

export enum DashPage {
    ADMIN = "admin",
    CUSTOMERS = "customers",
    HOME = "home",
    WALLET = "wallet",
    SETTINGS = "settings",
}

export type DashboardProps = {
    page: DashPage;
    defaultTab?: string;
    defaultShowTransfer?: boolean;
    defaultAddress?: string;
    config?: Config;
}

const Dashboard: React.FC<DashboardProps> = ({ page, defaultTab, defaultShowTransfer, defaultAddress, config }) => {
    const dashContent = useMemo(() => {
        switch (page) {
            case DashPage.HOME:
                return <DashboardHomeContent initialConfig={config as Config} />
            case DashPage.ADMIN:
                return <DashboardAdminContent defaultTab={defaultTab} />
            case DashPage.WALLET:
                return <DashboardWalletContent defaultShowTransfer={defaultShowTransfer} defaultAddress={defaultAddress} />
            case DashPage.SETTINGS:
                return <DashboardSettingsContent />
            case DashPage.CUSTOMERS:
                return <DashboardCustomersContent />
            default:
                return <div>Not Found</div>
        }
    }, [config, page, defaultTab, defaultShowTransfer, defaultAddress])

    return <div className="container px-6 py-2 mx-auto">
        {dashContent}
    </div>
}

export default Dashboard;

