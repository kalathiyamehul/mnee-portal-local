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
  const { data: session, status } = useSession() as { data: Session | null; status: string };
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab as TabType);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set tab from URL on mount
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabType;
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Update URL when tab changes (but don't wait for navigation)
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/dash/super-admin?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="tabs tabs-boxed">
        <button
          type="button"
          className={`tab ${activeTab === "roles" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("roles")}
        >
          roles
        </button>
        <button
          type="button"
          className={`tab ${activeTab === "threshold" ? "tab-active" : ""}`}
          onClick={() => handleTabChange("threshold")}
        >
          threshold
        </button>
      </div>

      <div className="animate-fade-in">
        {status === "loading" ? (
          <div className="flex justify-center items-center h-32">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <>
            {activeTab === "roles" && <RolesTab />}
            {activeTab === "threshold" && <ThresholdTab />}
          </>
        )}
      </div>
    </div>
  );
}
