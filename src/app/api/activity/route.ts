import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function GET(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get pagination parameters from URL
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        // If page and limit are -1, return all records
        const shouldReturnAll = page === -1 && limit === -1;

        // Get total count and paginated activity logs
        const [totalCount, activityLogs] = await Promise.all([
            prisma.activityLog.count(),
            prisma.activityLog.findMany({
                skip: shouldReturnAll ? 0 : (page - 1) * limit,
                take: shouldReturnAll ? undefined : limit,
                orderBy: { createdAt: "desc" },
            })
        ]);

        return NextResponse.json({
            activityLogs,
            pagination: {
                total: totalCount,
                page: shouldReturnAll ? 1 : page,
                limit: shouldReturnAll ? totalCount : limit,
                totalPages: shouldReturnAll ? 1 : Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error("Error fetching activity logs:", error);
        return NextResponse.json(
            { error: "Failed to fetch activity logs" },
            { status: 500 }
        );
    }
} 