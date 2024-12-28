"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Activity } from "@/components/pages/dash/content/admin/types";

interface SystemStatusData {
  isPaused: boolean;
  hasPendingPause: boolean;
  freezeRequests: Activity[];
  blacklistRequests: Activity[];
  systemRequests: Activity[];
  mintRequests: Activity[];
  burnRequests: Activity[];
}

interface SystemStatusContextType {
  statusData: SystemStatusData | null;
  initialLoading: boolean;
  fetchStatus: () => Promise<void>;
  handlePauseToggle: () => Promise<void>;
  isPaused: boolean;
  hasPendingPause: boolean;
}

const SystemStatusContext = createContext<SystemStatusContextType | null>(null);

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusData, setStatusData] = useState<SystemStatusData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/status?includePending=true');
      const data = await response.json();
      setStatusData({
        isPaused: data.isPaused || false,
        hasPendingPause: data.hasPendingPause || false,
        freezeRequests: data.freezeRequests || [],
        blacklistRequests: data.blacklistRequests || [],
        systemRequests: data.systemRequests || [],
        mintRequests: data.mintRequests || [],
        burnRequests: data.burnRequests || []
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  }, []);

  const handlePauseToggle = useCallback(async () => {
    if (!statusData) return;

    const response = await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: statusData.isPaused ? 'RESUME' : 'PAUSE' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle system pause');
    }

    await fetchStatus();
  }, [statusData, fetchStatus]);

  useEffect(() => {
    const initialize = async () => {
      await fetchStatus();
      setInitialLoading(false);
    };

    initialize();

    // Set up polling interval
    const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds

    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const value = useMemo(() => ({ 
    statusData, 
    initialLoading, 
    fetchStatus, 
    handlePauseToggle,
    isPaused: statusData?.isPaused || false,
    hasPendingPause: statusData?.hasPendingPause || false,
  }), [statusData, initialLoading, fetchStatus, handlePauseToggle]);

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus() {
  const context = useContext(SystemStatusContext);
  if (!context) {
    throw new Error('useSystemStatus must be used within a SystemStatusProvider');
  }
  return context;
} 