import { useMemo } from "react"
import DashboardHomeContent from "./content/home"
import DashboardWalletContent from "./content/wallet"
import DashboardAdminContent from "./content/admin"
import DashboardSettingsContent from './content/settings';
import DashboardCustomersContent from "./content/customers";

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
}

const Dashboard: React.FC<DashboardProps> = ({ page, defaultTab, defaultShowTransfer, defaultAddress }) => {
    const dashContent = useMemo(() => {
        switch (page) {
            case DashPage.HOME:
                return <DashboardHomeContent />
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
    }, [page, defaultTab, defaultShowTransfer, defaultAddress])

    return <div className="container px-6 py-2 mx-auto">
        {dashContent}
    </div>
}

export default Dashboard;

