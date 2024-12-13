import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [
      totalCustomers,
      totalMintVolume,
      pendingMints,
      recentMints,
      activeBlacklists
    ] = await Promise.all([
      // Total number of customers
      prisma.customer.count(),
      
      // Total mint volume (last 24h)
      prisma.mintRequest.aggregate({
        where: {
          status: "APPROVED",
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        },
        _sum: {
          amount: true
        }
      }),
      
      // Pending mint requests
      prisma.mintRequest.count({
        where: {
          status: "PENDING"
        }
      }),

      // Recent mint requests
      prisma.mintRequest.findMany({
        take: 5,
        orderBy: {
          createdAt: "desc"
        },
        include: {
          customer: true
        }
      }),

      // Active blacklists
      prisma.blacklist.count({
        where: {
          status: "APPROVED",
          action: "BLACKLIST"
        }
      })
    ]);

    return NextResponse.json({
      totalCustomers,
      totalMintVolume: Number(totalMintVolume._sum.amount || 0n),
      pendingMints,
      recentMints: recentMints.map(mint => ({
        ...mint,
        amount: Number(mint.amount)
      })),
      activeBlacklists
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
} 