"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import type { StatusResponse } from "@/components/pages/dash/content/admin/types";

interface SystemStatusContextType {
  isPaused: boolean;
  hasPendingPause: boolean;
  handlePauseToggle: () => Promise<void>;
  statusData: StatusResponse | null;
  loading: boolean;
  initialLoading: boolean;
  fetchStatus: () => Promise<void>;
}

const SystemStatusContext = createContext<SystemStatusContextType | undefined>(undefined);

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [isPaused, setIsPaused] = useState(false);
  const [hasPendingPause, setHasPendingPause] = useState(false);
  const [statusData, setStatusData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      if (initialLoading) {
        setLoading(true);
      }
      const response = await fetch("/api/status?includePending=true");
      const data = await response.json();
      setStatusData(data);
      setIsPaused(data.isPaused);
      setHasPendingPause(data.systemRequests?.some(
        (req: any) => req.status === "PENDING" && req.action === "PAUSE"
      ));
    } catch (error) {
      console.error("Failed to fetch system status:", error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    try {
      const action = isPaused ? "RESUME" : "PAUSE";
      const response = await fetch("/api/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create pause request");
      }
      toast.success(`System ${action.toLowerCase()} request created`);
    } catch (error) {
      console.error("Failed to create pause request:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create pause request");
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <SystemStatusContext.Provider value={{ 
      isPaused, 
      hasPendingPause, 
      handlePauseToggle, 
      statusData, 
      loading, 
      initialLoading,
      fetchStatus 
    }}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (context === undefined) {
    throw new Error("useSystemStatus must be used within a SystemStatusProvider");
  }
  return context;
} 