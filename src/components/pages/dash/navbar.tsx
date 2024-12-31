"use client";

import { SystemStatus } from "./content/admin/SystemStatus";
import { useSystemStatus } from "@/contexts/SystemStatusContext";

const Navbar = () => {
	const { isPaused, hasPendingPause, handlePauseToggle, hasPendingResume } = useSystemStatus();

	const handleMenuClick = () => {
		const toggle = document.getElementById('sidebar-toggle') as HTMLInputElement;
		if (toggle) toggle.checked = !toggle.checked;
	};

	return (
		<div className="navbar bg-base-100">
			<div className="flex-none md:hidden">
				<button type="button" className="btn btn-square btn-ghost" onClick={handleMenuClick}>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-5 h-5 stroke-current">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
					</svg>
				</button>
			</div>
			<div className="flex-1 px-8">
				<SystemStatus
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          hasPendingPause={hasPendingPause}
          hasPendingResume={hasPendingResume}				/>
			</div>
		</div>
	);
};

export default Navbar;
