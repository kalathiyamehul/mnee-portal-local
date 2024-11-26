import { useMemo } from "react"
import DashboardHomeContent from "./content/home"
import DashboardWalletContent from "./content/wallet"

export const enum DashPage {
    HOME = "home",
    WALLET = "wallet",
}

export type DashbpardProps = {
    page: DashPage
}

const Dashboard: React.FC<DashbpardProps> = ({ page }) => {
    const dashContent = useMemo(() => {
        switch (page) {
            case DashPage.HOME:
                return <DashboardHomeContent />
            case DashPage.WALLET:
                return <DashboardWalletContent />
            default:
                return <div>Not Found</div>
        }
    }, [page])


    return <div className="container px-6 py-8 mx-auto">
        <h3 className="text-3xl font-medium text-gray-700">Dashboard : {page}</h3>

        {dashContent}
    </div>
}

export default Dashboard;
