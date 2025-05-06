"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FaGear, FaSliders } from "react-icons/fa6";
import { FaWallet, FaSignOutAlt, FaUsers, FaShieldAlt, FaExchangeAlt } from "react-icons/fa";
import { TbActivityHeartbeat } from "react-icons/tb";
import { motion } from "framer-motion";
import { getGravatarUrl } from "@/utils/gravatar";

const menuItems = [
  { name: "Dashboard", href: "/dash", icon: TbActivityHeartbeat },
  { name: "Wallet", href: "/dash/wallet", icon: FaWallet },
  { name: "Customers", href: "/dash/customers", icon: FaUsers },
  { name: "Admin", href: "/dash/admin", icon: FaGear },
  { name: "Transactions", href: "/dash/transactions", icon: FaExchangeAlt },
  { name: "Config", href: "/dash/settings", icon: FaSliders },
  {
    name: "SuperAdmin",
    href: "/dash/super-admin",
    icon: FaShieldAlt,
    subItems: [
      { name: "Roles", href: "/dash/super-admin/roles", icon: FaUsers },
      {
        name: "Threshold Config",
        href: "/dash/super-admin/threshold",
        icon: FaGear,
      },
    ],
  },
];

const Sidebar: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = useState(pathname);

  return (
    <div className="bg-base-200 w-56 min-h-full text-base-content flex flex-col">
      <div className="sticky top-0 flex flex-col flex-1">
        <div className="text-4xl font-black text-center py-6 italic">MNEE</div>
        <nav className="flex-1">
          <ul className="menu px-2 py-2 w-full [&_li>*]:!bg-transparent [&_li>*:hover]:!bg-transparent [&_li>*:focus]:!bg-transparent [&_li>.active]:!bg-transparent [&_li>*]:!outline-none [&_li>*]:!shadow-none">
            {menuItems.map((item) => {
              const isActive = item.href === pathname;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      relative group flex items-center gap-2 px-3 py-2 rounded-lg
                      ${isActive ? "font-medium" : "text-base-content/70"}
                    `}
                    onMouseOver={() => setHoveredPath(item.href)}
                    onMouseLeave={() => setHoveredPath(pathname)}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.name}</span>
                    {item.href === hoveredPath && (
                      <motion.div
                        className="absolute inset-0 bg-base-content/10 rounded-lg -z-10"
                        layoutId="sidebar"
                        aria-hidden="true"
                        transition={{
                          type: "spring",
                          bounce: 0.15,
                          stiffness: 100,
                          damping: 15,
                          duration: 0.5
                        }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto border-t border-base-300">
          <div className="p-4">
            <Link href='/profile' className="flex items-center gap-3 px-4 py-2 rounded-lg text-base-content/70 hover:bg-base-300/30 transition-colors duration-300">
              <div className="avatar">
                <div className="mask mask-squircle w-10 h-10">
                  <img
                    src={getGravatarUrl(session?.user?.email ?? "")}
                    alt="User avatar"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium text-base-content">
                  {session?.user?.email}
                </div>
              </div>
            </Link>
            <Link 
              href="/logout" 
              className="flex items-center gap-3 px-4 py-2 mt-2 rounded-lg text-base-content/70 hover:text-base-content hover:bg-base-300/30 transition-colors duration-300"
            >
              <FaSignOutAlt className="w-4 h-4" />
              <span>Sign Out</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
