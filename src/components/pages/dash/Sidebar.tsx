// src/components/pages/dash/sidebar.tsx
'use client';

import type React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { usePathname } from "next/navigation";
import { FaGear, FaGears, FaWallet } from "react-icons/fa6";
import { RiDashboardFill } from "react-icons/ri";
import { FaSignOutAlt } from "react-icons/fa";


const Sidebar: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Determine the active page based on the pathname
  const getActivePage = () => {
    if (pathname.endsWith('/dash')) return 'dash';
    if (pathname.startsWith('/dash/wallet')) return 'wallet';
    if (pathname.startsWith('/dash/admin')) return 'admin';
    return '';
  };

  const activePage = getActivePage();
  
  return (
    <aside className="w-64 bg-base-100 h-full">
      {/* Sidebar content */}
      <div className="flex flex-col h-full">
        {/* Logo and title */}
        <div className="flex items-center justify-center mt-8">
          <div className="flex items-center">
            <span className="mx-2 text-2xl font-semibold text-base-content">
              MNEE
            </span>
          </div>
        </div>
        <nav className="mt-6 p-2 flex-1">
          <Link
            href="/dash"
            className={`flex items-center px-6 py-2 text-sm font-medium rounded-lg ${
              activePage === 'dash'
                ? 'bg-secondary text-secondary-content'
                : 'hover:bg-secondary hover:text-secondary-content'
            }`}
          >
            <RiDashboardFill className="mr-2" /> Dashboard
          </Link>
          <Link
            href="/dash/wallet"
            className={`flex items-center px-6 py-2 mt-2 text-sm font-medium rounded-lg ${
              activePage === 'wallet'
                ? 'bg-secondary text-secondary-content'
                : 'hover:bg-secondary hover:text-secondary-content'
            }`}
          >
            <FaWallet className="mr-2" /> Wallet
          </Link>
          <Link
            href="/dash/admin"
            className={`flex items-center px-6 py-2 mt-2 text-sm font-medium rounded-lg ${
              activePage === 'admin'
                ? 'bg-secondary text-secondary-content'
                : 'hover:bg-secondary hover:text-secondary-content'
            }`}
          >
            <FaGear className="mr-2" /> Admin
          </Link>
          <Link
            className="flex items-center px-6 py-2 mt-2 text-sm font-medium hover:bg-secondary hover:text-secondary-content rounded-lg"
            href={`${process.env.NEXT_PUBLIC_MNEE_API}/v1/docs`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MdOutlineOpenInNew className="mr-2" /> Cosigner Docs
          </Link>
          <Link href="/dash/settings" className="flex items-center gap-2">
            <FaGears /> Settings
          </Link>
          {/* Sign Out */}
          {session && (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center px-6 py-2 mt-2 text-sm font-medium hover:bg-secondary hover:text-secondary-content rounded-lg"
            >
              <FaSignOutAlt className="mr-2" /> Sign Out
            </button>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;