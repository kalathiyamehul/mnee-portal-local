// src/app/api/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Get the latest approved action
  const latestApproved = await prisma.actionRequest.findFirst({
    where: { status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
  });

  const isPaused = latestApproved?.action === 'PAUSE';

  // Get all action requests with their approvals
  const actionRequests = await prisma.actionRequest.findMany({
    include: { 
      requester: true,
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
  });

  // Get all freeze requests with their approvals
  const freezeRequests = await prisma.freezeRequest.findMany({
    include: { 
      requester: true,
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
  });

  // Combine and sort all activities
  const allActivities = [
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
    }))
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({
    isPaused,
    activities: allActivities,
  });
}