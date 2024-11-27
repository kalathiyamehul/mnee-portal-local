"use client";

import type { Session } from "next-auth";

type NavbarProps = {
	session: Session;
};

const Navbar: React.FC<NavbarProps> = ({ session }) => {
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
			<div className="flex-1 px-2 mx-2 text-sm">{session.user.email}</div>
		</div>
	);
};

export default Navbar;
