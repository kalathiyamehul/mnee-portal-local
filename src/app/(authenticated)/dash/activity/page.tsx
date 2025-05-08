import Dashboard from "@/components/pages/dash";
import { DashPages } from "@/types/dashboard";
import { getConfig } from "@/lib/config";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin");
  }

  const config = await getConfig();
  if (!config) {
    redirect("/dash");
  }

  // Get paginated activity logs
  const page = 1;
  const limit = 10;
  const [totalCount, activityLogs] = await Promise.all([
    prisma.activityLog.count(),
    prisma.activityLog.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <Dashboard
      page={DashPages.ACTIVITY}
      config={config}
      activityLogs={activityLogs}
      pagination={{
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      }}
    />
  );
}
