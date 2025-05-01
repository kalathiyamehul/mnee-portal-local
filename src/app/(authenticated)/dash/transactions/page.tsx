import Dashboard from '@/components/pages/dash';
import { DashPages } from '@/types/dashboard';
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function TransactionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const config = await getConfig();
  if (!config) {
    redirect("/setup?fromDashTransactions=true");
  }

  return <Dashboard page={DashPages.TRANSACTIONS} config={config} />;
}