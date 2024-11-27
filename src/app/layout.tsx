// src/app/layout.tsx
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";
import { getConfig } from "@/lib/config";
import { redirect } from "next/navigation";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const config = await getConfig();

  if (!config?.tokenId) {
    redirect("/setup");
  }

  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}