"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FaGear, FaSliders } from "react-icons/fa6";
import { FaWallet, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { TbActivityHeartbeat } from "react-icons/tb";
import { motion } from "framer-motion";

const menuItems = [
  { name: "Dashboard", href: "/dash", icon: TbActivityHeartbeat },
  { name: "Wallet", href: "/dash/wallet", icon: FaWallet },
  { name: "Customers", href: "/dash/customers", icon: FaUsers },
  { name: "Admin", href: "/dash/admin", icon: FaGear },
  { name: "Config", href: "/dash/settings", icon: FaSliders },
];

const Sidebar: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [hoveredPath, setHoveredPath] = useState(pathname);

  return (
    <div className="bg-base-200 w-56 min-h-full text-base-content">
      <div className="sticky top-0">
        <div className="text-4xl font-black text-center py-6 italic">MNEE</div>
        <nav className="">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const isActive = item.href === pathname;
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center px-4 h-12 rounded-sm relative
                      transition-colors duration-300
                      ${isActive 
                        ? "text-base-content font-medium border-l-2 border-primary/75" 
                        : "text-base-content/70 hover:text-base-content"
                      }
                    `}
                    onMouseOver={() => setHoveredPath(item.href)}
                    onMouseLeave={() => setHoveredPath(pathname)}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span>{item.name}</span>
                    {item.href === hoveredPath && (
                      <motion.div
                        className="absolute inset-0 bg-base-300/30 -z-10"
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
        <div className="px-4 pt-4 border-t border-base-300">
          <div className="text-sm text-base-content/50 mb-2">
            {session?.user?.email}
          </div>
          <Link 
            href="/logout" 
            className="flex items-center px-4 h-12 rounded-sm text-base-content/70 hover:text-base-content transition-colors duration-300"
          >
            <FaSignOutAlt className="w-5 h-5 mr-3" />
            Sign Out
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
