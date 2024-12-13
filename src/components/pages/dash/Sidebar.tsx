// src/components/pages/dash/sidebar.tsx
"use client";

import type React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { FaGear, FaSliders, FaWallet } from "react-icons/fa6";
import { FaSignOutAlt, FaUsers } from "react-icons/fa";
import { TbActivityHeartbeat } from "react-icons/tb";

const Sidebar: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="menu bg-base-200 w-56 min-h-full text-base-content">
      <div className="sticky top-0">
        <div className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="/dash"
                className={`${pathname === "/dash" ? "active" : ""}`}
              >
                <TbActivityHeartbeat className="mr-2" /> Dashboard
              </Link>
            </li>
            <li>
              <Link
                href="/dash/wallet"
                className={`${pathname === "/dash/wallet" ? "active" : ""}`}
              >
                <FaWallet className="mr-2" /> Wallet
              </Link>
            </li>
            <li>
              <Link
                href="/dash/customers"
                className={`${pathname === "/dash/customers" ? "active" : ""}`}
              >
                <FaUsers className="mr-2" /> Customers
              </Link>
            </li>
            <li>
              <Link
                href="/dash/admin"
                className={`${pathname === "/dash/admin" ? "active" : ""}`}
              >
                <FaGear className="mr-2" /> Admin
              </Link>
            </li>
            <li>
              <Link
                href="/dash/settings"
                className={`${pathname === "/dash/settings" ? "active" : ""}`}
              >
                <FaSliders className="mr-2" /> Config
              </Link>
            </li>
          </ul>
        </div>
        <div className="p-4 border-t border-base-300">
          <div className="text-sm opacity-50 mb-2">{session?.user?.email}</div>
          <Link href="/logout" className="btn btn-ghost btn-block justify-start">
            <FaSignOutAlt className="mr-2" /> Sign Out
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
