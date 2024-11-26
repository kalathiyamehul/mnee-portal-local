// src/components/pages/dash/sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { MdOutlineOpenInNew } from 'react-icons/md';
import { DashPage } from '@/components/pages/dash';
import { usePathname } from "next/navigation";

type SidebarProps = {};

const Sidebar: React.FC<SidebarProps> = () => {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Determine the active page based on the pathname
  const getActivePage = () => {
    if (pathname.endsWith('/dash')) return 'dash';
    if (pathname.startsWith('/dash/wallet')) return 'wallet';
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
            {/* Logo SVG */}
            <svg
              className="w-12 h-12"
              viewBox="0 0 512 512"
              fill="none"
            >
              <path
                d="M201.694 387.105C231.686 417.098 280.312 417.098 310.305 387.105C325.301 372.109 332.8 352.456 332.8 332.8C332.8 313.144 325.301 293.491 310.305 278.495C295.309 263.498 288 256 275.2 230.4C256 243.2 243.201 320 243.201 345.6C201.694 345.6 179.2 332.8 179.2 332.8C179.2 352.456 186.698 372.109 201.694 387.105Z"
                fill="currentColor"
              ></path>
            </svg>
            <span className="mx-2 text-2xl font-semibold text-base-content">
              MNEE Portal
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
            Dashboard
          </Link>
          <Link
            href="/dash/wallet"
            className={`flex items-center px-6 py-2 mt-2 text-sm font-medium rounded-lg ${
              activePage === 'wallet'
                ? 'bg-secondary text-secondary-content'
                : 'hover:bg-secondary hover:text-secondary-content'
            }`}
          >
            Wallet
          </Link>
          <Link
            className="flex items-center px-6 py-2 mt-2 text-sm font-medium hover:bg-secondary hover:text-secondary-content rounded-lg"
            href={`${process.env.NEXT_PUBLIC_MNEE_API}/v1/docs`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cosigner Docs <MdOutlineOpenInNew className="ml-2" />
          </Link>
          {/* Sign Out */}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center px-6 py-2 mt-2 text-sm font-medium hover:bg-secondary hover:text-secondary-content rounded-lg"
            >
              Sign Out
            </button>
          )}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;