"use client";

import { BalanceProvider } from "@/contexts/BalanceContext";
import type { ReactNode } from "react";

export function AuthenticatedProviders({ children }: { children: ReactNode }) {
  return (
    <BalanceProvider>
      {children}
    </BalanceProvider>
  );
}