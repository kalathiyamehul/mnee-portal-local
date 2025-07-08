"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import RolesTab from "./RolesTab";
import UsersTab from "./UsersTab";
import { useRouter, useSearchParams } from "next/navigation";
import ConfigureTab from "./ConfigureTab";

type TabType = "roles" | "configuration" | "users";

interface AdminPageProps {
  defaultTab?: string;
}

export default function SuperAdminPage({
  defaultTab = "roles",
}: AdminPageProps) {
  const { data: session } = useSession() as { data: Session | null };
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab as TabType);
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    setActiveTab(defaultTab as TabType);
  }, [defaultTab]);

  const handleTabChange = (tab: TabType) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/dash/super-admin?${params.toString()}`);
  };

  if (!session) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs tabs-boxed">
        <button
          type="button"
          className={`tab ${activeTab === "roles" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("roles")}
        >
          Roles
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "configuration" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("configuration")}
        >
          Configuration
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "users" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("users")}
        >
          Users
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "configuration" && <ConfigureTab />}
        {activeTab === "users" && <UsersTab />}
      </div>
    </div>
  );
}
