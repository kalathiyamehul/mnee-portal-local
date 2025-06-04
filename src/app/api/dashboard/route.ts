import { withCSRF } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { NextResponse } from "next/server";

export const GET = withCSRF(async function() {
  try {
    const [
      totalCustomers,
      totalMintVolume,
      pendingMints,
      recentMints,
      activeBlacklists,
      pendingBurns,
      recentBurns
    ] = await Promise.all([
      // Total number of customers
      prisma.customer.count(),
      
      // Total mint volume (last 24h)
      prisma.mintRequest.aggregate({
        where: {
          status: "DONE",
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
          customer: true,
          requester: {
            select: {
              email: true,
              name: true
            }
          },
          approvals: {
            include: {
              approver: {
                select: {
                  email: true,
                  name: true
                }
              }
            }
          }
        }
      }),

      // Active restrictions (blacklists + freezes)
      Promise.all([
        // Get addresses that are currently blacklisted (have a BLACKLIST action with no later UNBLACKLIST)
        prisma.$queryRaw<[{ count: number }]>`
          WITH latest_actions AS (
            SELECT DISTINCT ON (address) address, action
            FROM blacklist_request
            WHERE status = 'APPROVED'
            ORDER BY address, created_at DESC
          )
          SELECT COUNT(*)::int as count
          FROM latest_actions
          WHERE action = 'BLACKLIST'
        `.then(result => result[0].count),
        prisma.freezeRequest.findMany({
          where: {
            status: "APPROVED",
          },
          orderBy: {
            createdAt: "desc"
          },
          distinct: ["address"]
        }).then(freezes => {
          // For each address, get the latest freeze request
          const activelyFrozen = freezes.filter(freeze => freeze.action === "FREEZE");
          return activelyFrozen.length;
        })
      ]).then(([blacklists, freezes]) => blacklists + freezes),

      // Pending burn requests
      prisma.burnRequest.count({
        where: {
          status: "PENDING"
        }
      }),

      // Recent burn requests
      prisma.burnRequest.findMany({
        take: 5,
        orderBy: {
          createdAt: "desc"
        },
        include: {
          requester: {
            select: {
              email: true,
              name: true
            }
          },
          approvals: {
            include: {
              approver: {
                select: {
                  email: true,
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      totalCustomers,
      totalMintVolume: Number(totalMintVolume._sum.amount || 0n),
      pendingMints,
      recentMints: recentMints.map(mint => ({
        ...mint,
        amount: Number(mint.amount),
        type: 'MINT' as const,
        createdAt: mint.createdAt.toISOString()
      })),
      activeBlacklists,
      pendingBurns,
      recentBurns: recentBurns.map(burn => ({
        ...burn,
        amount: Number(burn.amount),
        createdAt: burn.createdAt.toISOString()
      }))
    });
  } catch (error) {
    console.error("Dashboard metrics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}, createAPIRateLimit())