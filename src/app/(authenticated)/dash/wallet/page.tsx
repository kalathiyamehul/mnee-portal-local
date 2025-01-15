import Dashboard from '@/components/pages/dash';
import { DashPages } from '@/types/dashboard';
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const config = await getConfig();
  if (!config) {
    redirect("/setup");
  }

  const params = await searchParams;
  const showTransfer = params.showTransfer === 'true';
  const address = params.address as string | undefined;
  
  return <Dashboard page={DashPages.WALLET} defaultShowTransfer={showTransfer} defaultAddress={address} config={config} />;
}