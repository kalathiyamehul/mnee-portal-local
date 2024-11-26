// app/providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { YoursProvider } from "yours-wallet-provider";
import { SessionProvider } from 'next-auth/react';
import { PropsWithChildren } from "react";

const queryClient = new QueryClient();

export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <YoursProvider>
        <SessionProvider>{children}</SessionProvider>
      </YoursProvider>
    </QueryClientProvider>
  );
}