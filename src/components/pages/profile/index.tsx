"use client";

import { useSession } from "next-auth/react";
import { getGravatarUrl } from "@/utils/gravatar";
import { useState } from "react";
import { ChangePassword } from "@/components/pages/dash/content/settings/ChangePassword";
import TwoFA from "./twoFA";
import { usePermission } from "@/hooks/usePermission";
import { Action, Resource } from "@/lib/permission";

export default function ProfileScreen() {
  const { data: session } = useSession();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { hasAllPermissions, isSuperAdmin } = usePermission();
  const isAdmin = hasAllPermissions([
    { resource: Resource.MINT, action: Action.CREATE },
    { resource: Resource.BURN, action: Action.CREATE },
    { resource: Resource.CUSTOMER, action: Action.CREATE },
    { resource: Resource.REFUND, action: Action.CREATE },
    { resource: Resource.BLACKLIST, action: Action.CREATE },
    { resource: Resource.FREEZE, action: Action.CREATE },
  ]);

  return (
    <div className="container p-4 space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Profile Settings</h1>
      <div className="grid gap-6">
        {/* Profile Info Section */}
        <div className="bg-base-200 rounded-lg p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="avatar">
                <div className="mask mask-squircle w-20 h-20">
                  <img
                    src={getGravatarUrl(session?.user?.email ?? "")}
                    alt="User avatar"
                  />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-semibold">
                  {session?.user?.name}
                </h2>
                <p className="text-xl-content/70">{session?.user?.email}</p>
                <p className="text-xl-content/70">
                  Role: {isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "User"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-base-200 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4">Security Settings</h3>
          <div className="grid gap-6">
            {/* Password Section */}
            <div className="flex justify-between items-center pb-4 border-b border-base-300">
              <div>
                <h4 className="text-lg font-medium">Password</h4>
                <p className="text-sm text-neutral-500">
                  Change your account password
                </p>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowChangePassword(true)}
              >
                Change Password
              </button>
            </div>

            {/* 2FA Section */}
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-lg font-medium">
                  Two-Factor Authentication
                </h4>
                <p className="text-sm text-neutral-500">
                  Add an extra layer of security to your account
                </p>
              </div>
              <TwoFA />
            </div>
          </div>
        </div>
      </div>

      {showChangePassword && (
        <div className="modal modal-open">
          <div className="modal-box">
            <ChangePassword onClose={() => setShowChangePassword(false)} />
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowChangePassword(false)}
          ></div>
        </div>
      )}
    </div>
  );
}
