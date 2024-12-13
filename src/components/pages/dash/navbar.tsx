"use client";

import type { Session } from "next-auth";
import { SystemStatus } from "./content/admin/SystemStatus";
import { useSystemStatus } from "@/contexts/SystemStatusContext";

type NavbarProps = {
	session: Session;
};

const Navbar: React.FC<NavbarProps> = ({ session }) => {
	const { isPaused, hasPendingPause, handlePauseToggle } = useSystemStatus();

	return (
		<div className="w-full navbar bg-base-300">
			<div className="flex-none lg:hidden">
				<label htmlFor="sidebar-toggle" className="btn btn-square btn-ghost">
					{/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
					<svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
						<path
							d="M4 6H20M4 12H20M4 18H11"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</label>
			</div>
			<div className="flex-1">
				<SystemStatus 
					isPaused={isPaused} 
					hasPendingPause={hasPendingPause} 
					onPauseToggle={handlePauseToggle} 
				/>
			</div>
		</div>
	);
};

export default Navbar;
