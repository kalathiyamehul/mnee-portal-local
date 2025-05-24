"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Activity } from "@/components/pages/dash/content/admin/types";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { apiFetch } from "@/utils/api";

interface SystemStatusData {
  isPaused: boolean;
  hasPendingPause: boolean;
  hasPendingResume: boolean;
  freezeRequests: Activity[];
  blacklistRequests: Activity[];
  systemRequests: Activity[];
  mintRequests: Activity[];
  burnRequests: Activity[];
  refundRequests: Activity[];
  customerRequests: Activity[]; // Add this line
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
      const response = await apiFetch("/api/status?includePending=true");
      if (response.status === 401) {
        // Handle unauthorized - clear data
        setStatusData(null);
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch status");
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
        burnRequests: data.burnRequests || [],
        refundRequests: data.refundRequests || [],
        customerRequests: data.customerRequests || [], // Add this line
      });
    } catch (error) {
      // console.error('Error fetching system status:', error);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch system status"
      );
      setStatusData(null);
    }
  }, [session?.user]);

  const handlePauseToggle = useCallback(async () => {
    if (!statusData || !session?.user) return;

    const response = await apiFetch("/api/pause", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: statusData.isPaused ? "RESUME" : "PAUSE",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to toggle system pause");
    }

    await fetchStatus();
  }, [statusData, fetchStatus, session?.user]);

  useEffect(() => {
    // Only start polling if authenticated
    if (status === "loading") return;
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
    // const interval = setInterval(fetchStatus, 5500);

    // Clean up interval on unmount or when session changes
    // return () => clearInterval(interval);
  }, [fetchStatus, session?.user, status]);

  // Add this SSE effect to listen for real-time updates
  useEffect(() => {
    // Create SSE connection
    const eventSource = new EventSource("/api/sse");

    // Connection established
    eventSource.onopen = () => {
      console.log("SSE connection established");
    };

    eventSource.addEventListener("mintUpdate", (event) => {
      try {
        const data = JSON.parse(event.data);
        const { activityId, approval, type } = data;
        if (type === "APPROVE") {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            const updateActivity = (activities: Activity[]) =>
              activities.map((activity) => {
                const approvals: any = activity.approvals;
                const approval_check = approvals.find(
                  (approval_temp: any) => approval_temp.id === approval.id
                );
                if (activity.id === activityId && !approval_check) {
                  approvals.push(approval);
                  const updatedActivity = {
                    ...activity,
                    approvals: approvals,
                  };
                  return updatedActivity;
                }
                return activity;
              });
            return {
              ...prev,
              mintRequests: updateActivity(prev.mintRequests),
            };
          });
        }
        if (type === "REJECT") {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              mintRequests: prev.mintRequests.filter(
                (activity: any) => activity.id !== activityId
              ),
            };
          });
        }
        if (type === "CREATE") {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              mintRequests: [...prev.mintRequests, approval],
            };
          });
        }
      } catch (error) {
        console.error("Error handling SSE event:", error);
      }
    });
    eventSource.addEventListener("cancelUpdate", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("data", data);
        const {
          actionRequestId,
          freezeRequestId,
          blacklistRequestId,
          mintRequestId,
          burnRequestId,
          refundRequestId,
          customerRequestId,
        } = data;
        if (actionRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              mintRequests: prev.mintRequests.filter(
                (activity: any) => activity.id !== actionRequestId
              ),
            };
          });
        }
        if (freezeRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              freezeRequests: prev.freezeRequests.filter(
                (activity: any) => activity.id !== freezeRequestId
              ),
            };
          });
        }
        if (blacklistRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              blacklistRequests: prev.blacklistRequests.filter(
                (activity: any) => activity.id !== blacklistRequestId
              ),
            };
          });
        }
        if (mintRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              mintRequests: prev.mintRequests.filter(
                (activity: any) => activity.id !== mintRequestId
              ),
            };
          });
        }
        if (burnRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              burnRequests: prev.burnRequests.filter(
                (activity: any) => activity.id !== burnRequestId
              ),
            };
          });
        }
        if (refundRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              refundRequests: prev.refundRequests.filter(
                (activity: any) => activity.id !== refundRequestId
              ),
            };
          });
        }
        if (customerRequestId) {
          setStatusData((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              customerRequests: prev.customerRequests.filter(
                (activity: any) => activity.id !== customerRequestId
              ),
            };
          });
        }
      } catch (error) {
        console.error("Error handling SSE event:", error);
      }
    });

    // Handle errors
    eventSource.onerror = (error) => {
      console.error("SSE connection error:", error);
      eventSource.close();
    };

    // Clean up on unmount
    return () => {
      console.log("Closing SSE connection");
      eventSource.close();
      eventSource.removeEventListener("mintUpdate", (event) => {
        console.log("mintUpdate", event);
      });
      eventSource.removeEventListener("cancelUpdate", (event) => {
        console.log("cancelUpdate", event);
      });
    };
  }, [fetchStatus]);

  const value = useMemo(
    () => ({
      statusData,
      initialLoading,
      fetchStatus,
      handlePauseToggle,
      isPaused: statusData?.isPaused || false,
      hasPendingPause: statusData?.hasPendingPause || false,
      hasPendingResume: statusData?.hasPendingResume || false,
    }),
    [statusData, initialLoading, fetchStatus, handlePauseToggle]
  );
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