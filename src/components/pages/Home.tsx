import Link from "next/link";
import DashboardWalletContent from "./dash/content/wallet";

const Home = () => {
	return (
		<div className="h-screen w-screen">
			<div className="flex flex-col items-center justify-center h-full">
				<h1 className="text-4xl font-black text-center mb-8 italic">MNEE</h1>
				<Link href="/login" className="btn btn-primary">
					Login
				</Link>

				<h4 className="text-center">Temporary Test Wallet</h4>
				<DashboardWalletContent />
			</div>
		</div>
	);
};

export default Home;
