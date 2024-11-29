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
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          password: true,
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
  });

  // Get all freeze requests with their approvals
  const freezeRequests = await prisma.freezeRequest.findMany({
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          password: true,
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
  });

  // Get all mint requests with their approvals
  const mintRequests = await prisma.mintRequest.findMany({
    include: { 
      requester: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          emailVerified: true,
          idAddress: true,
          password: true,
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
      approvals: [
        // Add requester's implicit approval for action requests
        {
          id: `${action.id}-requester`,
          approver: {
            name: action.requester.name,
            email: action.requester.email
          }
        },
        ...action.approvals
      ],
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
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return NextResponse.json({
    isPaused,
    activities: allActivities,
  });
}