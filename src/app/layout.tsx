// src/app/layout.tsx
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { CustomerProvider } from '@/contexts/CustomerContext';
import { SSEProvider } from '@/contexts/SSEContext';
import { SystemStatusProvider } from '@/contexts/SystemStatusContext';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="business">
      <body className={inter.className}>
        <Providers>
          <SSEProvider>
            <SystemStatusProvider>
              <CustomerProvider>
                {children}
                <Toaster 
                  position="bottom-right"
                  toastOptions={{
                    style: {
                      borderRadius: '10px',
                      background: '#333',
                      color: '#fff',
                    },
                  }}
                />
              </CustomerProvider>
            </SystemStatusProvider>
          </SSEProvider>
        </Providers>
      </body>
    </html>
  );
}