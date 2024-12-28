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
      const [allFreezeRequests, blacklistRequests, systemRequests, mintRequests, burnRequests] = await Promise.all([
        prisma.freezeRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.blacklistRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            status: true,
            action: true,
            createdAt: true,
            updatedAt: true,
            requester: {
              select: {
                name: true,
                email: true,
              },
            },
            approvals: {
              select: {
                id: true,
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
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: r.amount.toString()
        }))),
        prisma.burnRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: r.amount.toString()
        }))),
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

      const pendingActionRequest = await prisma.actionRequest.findFirst({
        where: {
          action: { in: ['PAUSE', 'RESUME'] },
          status: 'PENDING',
        },
      });

      const isPaused = latestPauseAction?.action === 'PAUSE';
      const hasPendingPause = !!pendingActionRequest;

      return NextResponse.json({
        isPaused,
        hasPendingPause,
        freezeRequests,
        blacklistRequests,
        systemRequests,
        mintRequests,
        burnRequests,
      });
    }

    // If type is specified, return only that type
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
        const blacklistRequests = await prisma.blacklistRequest.findMany({
          where: whereCondition,
          select: {
            id: true,
            address: true,
            status: true,
            action: true,
            createdAt: true,
            updatedAt: true,
            requester: {
              select: {
                name: true,
                email: true,
              },
            },
            approvals: {
              select: {
                id: true,
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
        return NextResponse.json({ blacklistRequests });
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
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: r.amount.toString()
        })));
        return NextResponse.json({ mintRequests });
      }
      case 'burn': {
        const burnRequests = await prisma.burnRequest.findMany({
          where: whereCondition,
          include: includeOptions,
          orderBy: { createdAt: 'desc' }
        }).then(requests => requests.map(r => ({
          ...r,
          amount: r.amount.toString()
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
      { error: 'Failed to fetch requests', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}