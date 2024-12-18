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
    throw new Error("Config not found");
  }

  const params = await searchParams;
  const tab = params.tab || 'activity';
  
  return <Dashboard page={DashPages.ADMIN} defaultTab={tab as string} config={config} />;
}