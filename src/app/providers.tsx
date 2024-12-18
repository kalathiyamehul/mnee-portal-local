// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SystemStatusProvider } from "@/contexts/SystemStatusContext";
import { YoursProvider } from "yours-wallet-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BalanceProvider } from "@/contexts/BalanceContext";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <BalanceProvider>
          <ThemeProvider>
            <YoursProvider>
              <SystemStatusProvider>
                {children}
              </SystemStatusProvider>
            </YoursProvider>
          </ThemeProvider>
        </BalanceProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}