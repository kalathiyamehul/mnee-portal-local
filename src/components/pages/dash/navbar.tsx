const Navbar: React.FC = () => {
    return (<div className="w-full navbar bg-base-300">
        <div className="flex-none lg:hidden">
            <label htmlFor="sidebar-toggle" className="btn btn-square btn-ghost">
                <svg
                    className="w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                >
                    <path
                        d="M4 6H20M4 12H20M4 18H11"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    ></path>
                </svg>
            </label>
        </div>
        navbar items
    </div>)
}

export default Navbar;