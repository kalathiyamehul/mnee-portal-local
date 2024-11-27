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

  // Get pending request
  const pendingRequest = await prisma.actionRequest.findFirst({
    where: { status: 'PENDING' },
    include: { requester: true },
  });

  // Get action history
  const history = await prisma.actionRequest.findMany({
    include: { requester: true },
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

  return NextResponse.json({
    isPaused,
    isPending: !!pendingRequest,
    pendingRequest,
    history,
    freezeRequests,
  });
}