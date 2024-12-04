// src/app/api/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ActionStatus } from '@prisma/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as ActionStatus | null;
  const type = searchParams.get('type');
  const limit = Number.parseInt(searchParams.get('limit') || '50', 10);

  // Get the latest approved action
  const latestApproved = await prisma.actionRequest.findFirst({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });

  const isPaused = latestApproved?.action === 'PAUSE';

  // Base where clause for status filtering
  const statusWhere = status ? { status } : {};

  // Get all action requests with their approvals
  const actionRequests = await prisma.actionRequest.findMany({
    where: statusWhere,
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          createdAt: true,
          updatedAt: true,
        }
      },
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Get all freeze requests with their approvals
  const freezeRequests = await prisma.freezeRequest.findMany({
    where: statusWhere,
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          createdAt: true,
          updatedAt: true,
        }
      },
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Get all blacklist requests with their approvals
  const blacklistRequests = await prisma.blacklistRequest.findMany({
    where: statusWhere,
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          createdAt: true,
          updatedAt: true,
        }
      },
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Get all mint requests with their approvals
  const mintRequests = await prisma.mintRequest.findMany({
    where: statusWhere,
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          createdAt: true,
          updatedAt: true,
        }
      },
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Combine and sort all activities
  let allActivities = [
    ...actionRequests.map(action => ({
      type: 'ACTION',
      id: action.id,
      action: action.action,
      status: action.status,
      createdAt: action.createdAt,
      requester: action.requester,
      approvals: action.approvals,
    })),
    ...freezeRequests.map(freeze => ({
      type: 'FREEZE',
      id: freeze.id,
      action: freeze.action,
      address: freeze.address,
      status: freeze.status,
      createdAt: freeze.createdAt,
      requester: freeze.requester,
      approvals: freeze.approvals,
    })),
    ...blacklistRequests.map(blacklist => ({
      type: 'BLACKLIST',
      id: blacklist.id,
      action: blacklist.action,
      address: blacklist.address,
      status: blacklist.status,
      createdAt: blacklist.createdAt,
      requester: blacklist.requester,
      approvals: blacklist.approvals,
    })),
    ...mintRequests.map(mint => ({
      type: 'MINT',
      id: mint.id,
      action: 'MINT',
      amount: mint.amount,
      address: mint.address,
      status: mint.status,
      createdAt: mint.createdAt,
      requester: mint.requester,
      approvals: mint.approvals,
    }))
  ];

  // Filter by type if specified
  if (type) {
    allActivities = allActivities.filter(activity => activity.type === type.toUpperCase());
  }

  // Sort by creation date
  allActivities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Apply limit after combining and sorting
  allActivities = allActivities.slice(0, limit);

  return NextResponse.json({
    isPaused,
    activities: allActivities,
  });
}