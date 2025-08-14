"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type SSEEventListener = (event: MessageEvent) => void;

interface SSEContextType {
  addEventListener: (eventType: string, listener: SSEEventListener) => void;
  removeEventListener: (eventType: string, listener: SSEEventListener) => void;
  isConnected: boolean;
}

const SSEContext = createContext<SSEContextType | null>(null);

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<SSEEventListener>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const addEventListener = (eventType: string, listener: SSEEventListener) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(listener);

    // Add listener to EventSource if it exists
    if (eventSourceRef.current) {
      eventSourceRef.current.addEventListener(eventType, listener);
    }
  };

  const removeEventListener = (eventType: string, listener: SSEEventListener) => {
    const listeners = listenersRef.current.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        listenersRef.current.delete(eventType);
      }
    }

    // Remove listener from EventSource if it exists
    if (eventSourceRef.current) {
      eventSourceRef.current.removeEventListener(eventType, listener);
    }
  };

  useEffect(() => {
    // Only create SSE connection if authenticated
    if (!session?.user) {
      // Clean up existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create new EventSource connection
    const eventSource = new EventSource("/api/sse");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      // console.log("SSE connection established");
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      // console.error("SSE connection error:", error);
    };

    // Add all existing listeners to the new EventSource
    listenersRef.current.forEach((listeners, eventType) => {
      listeners.forEach((listener) => {
        eventSource.addEventListener(eventType, listener);
      });
    });

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        setIsConnected(false);
      }
    };
  }, [session?.user]);

  const value = {
    addEventListener,
    removeEventListener,
    isConnected,
  };

  return <SSEContext.Provider value={value}>{children}</SSEContext.Provider>;
}

export function useSSE() {
  const context = useContext(SSEContext);
  if (!context) {
    throw new Error("useSSE must be used within an SSEProvider");
  }
  return context;
}