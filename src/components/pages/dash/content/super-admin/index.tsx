"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import RolesTab from "./RolesTab";
import ThresholdTab from "./ThresholdTab";
import { useRouter, useSearchParams } from "next/navigation";

type TabType = "roles" | "threshold";

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
          className={`tab ${activeTab === "threshold" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("threshold")}
        >
          Threshold
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "threshold" && <ThresholdTab />}
      </div>
    </div>
  );
}
