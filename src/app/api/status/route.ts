// src/app/api/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ActionStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const includePending = searchParams.get('includePending') === 'true';

  // Base query conditions
  const whereCondition = includePending ? {} : { status: 'APPROVED' as ActionStatus };
  const includeOptions = {
    requester: { select: { name: true, email: true } },
    approvals: {
      include: {
        approver: { select: { name: true, email: true } }
      }
    }
  };

  try {
    // If no type is specified, return all activities
    if (!type) {
      const [allFreezeRequests, blacklists, systemRequests, mintRequests, burnRequests] = await Promise.all([
        prisma.freezeRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.blacklist.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            createdAt: true,
            status: true,
            action: true,
            requester: {
              select: {
                name: true,
                email: true,
              },
            },
            approvals: {
              include: {
                approver: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.actionRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.mintRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            amount: true,
            status: true,
            txid: true,
            requiresApproval: true,
            createdAt: true,
            customerId: true,
            requester: {
              select: { name: true, email: true }
            },
            approvals: {
              include: {
                approver: { select: { name: true, email: true } }
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                address: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: Number(r.amount)
        }))),
        prisma.burnRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            amount: true,
            status: true,
            requiresApproval: true,
            createdAt: true,
            outpoint: true,
            requester: {
              select: { name: true, email: true }
            },
            approvals: {
              include: {
                approver: { select: { name: true, email: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: Number(r.amount)
        })))
      ]);

      // Group freeze requests by address and get most recent approved action
      const addressMap = new Map<string, typeof allFreezeRequests[0]>();
      for (const freeze of allFreezeRequests.filter(f => f.status === 'APPROVED')) {
        const existing = addressMap.get(freeze.address);
        if (!existing || freeze.createdAt > existing.createdAt) {
          addressMap.set(freeze.address, freeze);
        }
      }

      // Filter to only include addresses where most recent action is FREEZE
      const freezeRequests = allFreezeRequests.map(request => {
        const latestApproved = addressMap.get(request.address);
        return {
          ...request,
          isFrozen: latestApproved?.action === 'FREEZE'
        };
      });

      // Get system pause status
      const latestPauseAction = await prisma.actionRequest.findFirst({
        where: {
          action: { in: ['PAUSE', 'RESUME'] },
          status: 'APPROVED',
        },
        orderBy: { createdAt: 'desc' },
      });

      const pendingPauseRequest = await prisma.actionRequest.findFirst({
        where: {
          action: 'PAUSE',
          status: 'PENDING',
        },
      });

      const isPaused = latestPauseAction?.action === 'PAUSE';
      const hasPendingPause = !!pendingPauseRequest;

      return NextResponse.json({
        isPaused,
        hasPendingPause,
        freezeRequests,
        blacklists,
        systemRequests,
        mintRequests,
        burnRequests
      });
    }

    // Handle specific type requests
    switch (type) {
      case 'freeze': {
        const freezeRequests = await prisma.freezeRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ freezeRequests });
      }

      case 'blacklist': {
        const blacklists = await prisma.blacklist.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            createdAt: true,
            status: true,
            action: true,
            requester: {
              select: {
                name: true,
                email: true,
              },
            },
            approvals: {
              include: {
                approver: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ blacklists });
      }

      case 'system': {
        const systemRequests = await prisma.actionRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ systemRequests });
      }

      case 'mint': {
        const mintRequests = await prisma.mintRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            amount: true,
            status: true,
            txid: true,
            requiresApproval: true,
            createdAt: true,
            customerId: true,
            requester: {
              select: { name: true, email: true }
            },
            approvals: {
              include: {
                approver: { select: { name: true, email: true } }
              }
            },
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                address: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: Number(r.amount)
        })));
        return NextResponse.json({ mintRequests });
      }

      case 'burn': {
        const burnRequests = await prisma.burnRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            amount: true,
            status: true,
            requiresApproval: true,
            createdAt: true,
            outpoint: true,
            requester: {
              select: { name: true, email: true }
            },
            approvals: {
              include: {
                approver: { select: { name: true, email: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: Number(r.amount)
        })));
        return NextResponse.json({ burnRequests });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}