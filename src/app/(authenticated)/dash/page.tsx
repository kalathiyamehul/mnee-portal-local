import DashboardHomeContent from "@/components/pages/dash/content/home";
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const config = await getConfig();
  if (!config) {
    throw new Error("Config not found");
  }

  return <DashboardHomeContent initialConfig={config} />;
}