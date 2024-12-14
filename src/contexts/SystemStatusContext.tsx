"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Activity } from "@/components/pages/dash/content/admin/types";

interface SystemStatusData {
  isPaused: boolean;
  hasPendingPause: boolean;
  freezeRequests: Activity[];
  blacklists: Activity[];
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

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status?includePending=true');
      const data = await response.json();
      setStatusData(data);
    } catch (error) {
      console.error('Error fetching system status:', error);
    }
  };

  const handlePauseToggle = async () => {
    if (!statusData) return;

    const response = await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: statusData.isPaused ? 'UNPAUSE' : 'PAUSE' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to toggle system pause');
    }

    await fetchStatus();
  };

  useEffect(() => {
    const initialize = async () => {
      await fetchStatus();
      setInitialLoading(false);
    };

    initialize();
  }, []);

  return (
    <SystemStatusContext.Provider value={{ 
      statusData, 
      initialLoading, 
      fetchStatus, 
      handlePauseToggle,
      isPaused: statusData?.isPaused || false,
      hasPendingPause: statusData?.hasPendingPause || false,
    }}>
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