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

    return <div className="container px-6 py-2 mx-auto">
        {/* <div className="mb-4">
            <div className="text-sm breadcrumbs text-base-content/70">
                <ul>
                    <li className="capitalize">{page}</li>
                    {defaultTab && <li className="capitalize">{defaultTab}</li>}
                </ul>
            </div>
        </div> */}
        {dashContent}
    </div>
}
export default Dashboard;

