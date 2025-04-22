"use client";

import { useSession } from "next-auth/react";
import { getGravatarUrl } from "@/utils/gravatar";
import Link from "next/link";
import { useState } from "react";
import { ChangePassword } from "@/components/pages/dash/content/settings/ChangePassword";

export default function ProfileScreen() {
  const { data: session } = useSession();
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="container p-4 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Profile Settings</h1>
      <div className="bg-base-200 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="avatar">
            <div className="mask mask-squircle w-20 h-20">
              <img
                src={getGravatarUrl(session?.user?.email ?? "")}
                alt="User avatar"
              />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{session?.user?.name}</h2>
            <p className="text-xl-content/70">{session?.user?.email}</p>
          </div>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowChangePassword(true)}
        >
          Change Password
        </button>

        {showChangePassword && (
          <div className="modal modal-open">
            <div className="modal-box">
              <ChangePassword onClose={() => setShowChangePassword(false)} />
            </div>
            <div className="modal-backdrop" onClick={() => setShowChangePassword(false)}></div>
          </div>
        )}
      </div>
    </div>
  );
}