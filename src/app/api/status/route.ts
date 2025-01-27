// src/app/api/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSystemPaused } from "@/lib/systemStatus";
import { ActionStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [
      isPaused,
      mintRequests,
      burnRequests,
      freezeRequests,
      blacklistRequests,
      systemRequests,
      refundRequests,
    ] = await Promise.all([
      isSystemPaused(prisma),
      prisma.mintRequest.findMany({
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          customer: true,
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.burnRequest.findMany({
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.freezeRequest.findMany({
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.blacklistRequest.findMany({
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.actionRequest.findMany({
        where: {
          OR: [
            { action: 'PAUSE' },
            { action: 'RESUME' }
          ]
        },
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.refundRequest.findMany({
        include: {
          approvals: {
            include: {
              approver: true,
            },
          },
          requester: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    // Find pending pause/resume requests from systemRequests
    const pendingPauseRequest = systemRequests.find(r => r.action === 'PAUSE' && r.status === ActionStatus.PENDING);
    const pendingResumeRequest = systemRequests.find(r => r.action === 'RESUME' && r.status === ActionStatus.PENDING);

    return NextResponse.json({
      success: true,
      isPaused,
      hasPendingPause: !!pendingPauseRequest,
      hasPendingResume: !!pendingResumeRequest,
      mintRequests: mintRequests.map(r => ({
        ...r,
        amount: r.amount.toString(),
      })),
      burnRequests: burnRequests.map(r => ({
        ...r,
        amount: r.amount.toString(),
      })),
      freezeRequests,
      blacklistRequests,
      systemRequests,
      refundRequests: refundRequests.map(r => ({
        ...r,
        amount: r.amount.toString(),
      })),
    });
  } catch (error) {
    console.error("Error fetching system status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch system status" },
      { status: 500 }
    );
  }
}