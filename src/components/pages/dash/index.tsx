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
}

const Dashboard: React.FC<DashboardProps> = ({ page, defaultTab }) => {
    const dashContent = useMemo(() => {
        switch (page) {
            case DashPage.HOME:
                return <DashboardHomeContent />
            case DashPage.ADMIN:
                return <DashboardAdminContent defaultTab={defaultTab} />
            case DashPage.WALLET:
                return <DashboardWalletContent />
            case DashPage.SETTINGS:
                return <DashboardSettingsContent />
            case DashPage.CUSTOMERS:
                return <DashboardCustomersContent />
            default:
                return <div>Not Found</div>
        }
    }, [page, defaultTab])

    return <div className="container px-6 py-8 mx-auto">
        <h3 className="text-3xl font-medium text-gray-700">Dashboard : {page}</h3>

        {dashContent}
    </div>
}
export default Dashboard;

