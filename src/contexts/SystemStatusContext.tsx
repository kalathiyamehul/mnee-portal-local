"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Activity } from "@/components/pages/dash/content/admin/types";
import { useSession } from "next-auth/react";

interface SystemStatusData {
  isPaused: boolean;
  hasPendingPause: boolean;
  hasPendingResume: boolean;
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
  hasPendingResume: boolean;
}

const SystemStatusContext = createContext<SystemStatusContextType | null>(null);

export function SystemStatusProvider({ children }: { children: React.ReactNode }) {
  const [statusData, setStatusData] = useState<SystemStatusData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const { data: session, status } = useSession();

  const fetchStatus = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!session?.user) return;

    try {
      const response = await fetch('/api/status?includePending=true');
      if (response.status === 401) {
        // Handle unauthorized - clear data
        setStatusData(null);
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatusData({
        isPaused: data.isPaused || false,
        hasPendingPause: data.hasPendingPause || false,
        hasPendingResume: data.hasPendingResume || false,
        freezeRequests: data.freezeRequests || [],
        blacklistRequests: data.blacklistRequests || [],
        systemRequests: data.systemRequests || [],
        mintRequests: data.mintRequests || [],
        burnRequests: data.burnRequests || []
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
      setStatusData(null);
    }
  }, [session?.user]);

  const handlePauseToggle = useCallback(async () => {
    if (!statusData || !session?.user) return;

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
  }, [statusData, fetchStatus, session?.user]);

  useEffect(() => {
    // Only start polling if authenticated
    if (status === 'loading') return;
    if (!session?.user) {
      setStatusData(null);
      setInitialLoading(false);
      return;
    }

    const initialize = async () => {
      await fetchStatus();
      setInitialLoading(false);
    };

    initialize();

    // Set up polling interval only if authenticated
    const interval = setInterval(fetchStatus, 5000);

    // Clean up interval on unmount or when session changes
    return () => clearInterval(interval);
  }, [fetchStatus, session?.user, status]);

  const value = useMemo(() => ({ 
    statusData, 
    initialLoading, 
    fetchStatus, 
    handlePauseToggle,
    isPaused: statusData?.isPaused || false,
    hasPendingPause: statusData?.hasPendingPause || false,
    hasPendingResume: statusData?.hasPendingResume || false,
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