// src/app/layout.tsx
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";
import { redirect } from "next/navigation";
import { cache } from "react";

const getConfig = cache(async () => {
  const res = await fetch("/api/config", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch config");
  }
  return res.json();
});

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