// src/app/api/approve/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { actionRequestId } = await request.json();

  // Use a transaction to ensure data consistency
  const result = await prisma.$transaction(async (tx) => {
    // Verify the approving user exists
    const approvingUser = await tx.user.findUnique({
      where: { id: session.user.id }
    });

    if (!approvingUser) {
      throw new Error('Approving user not found');
    }

    // Fetch the action request
    const actionRequest = await tx.actionRequest.findUnique({
      where: { id: actionRequestId },
      include: { 
        approvals: true,
        requester: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!actionRequest) {
      throw new Error('Action request not found');
    }

    if (actionRequest.status !== 'PENDING') {
      throw new Error('Request is not pending');
    }

    // Prevent self-approval
    if (actionRequest.requestedBy === session.user.id) {
      throw new Error('Cannot approve your own request');
    }

    // Check if the user has already approved
    const existingApproval = await tx.actionApproval.findFirst({
      where: {
        actionRequestId,
        approvedBy: session.user.id,
      },
    });

    if (existingApproval) {
      throw new Error('You have already approved this request');
    }

    // Create a new approval
    await tx.actionApproval.create({
      data: {
        actionRequestId,
        approvedBy: session.user.id,
      },
    });

    // Check approval count (requires exactly 2 approvals)
    const approvalsCount = await tx.actionApproval.count({
      where: { actionRequestId },
    });

    if (approvalsCount === 2) {
      // Update action request status to APPROVED
      await tx.actionRequest.update({
        where: { id: actionRequestId },
        data: { status: 'APPROVED' },
      });

      return { status: 'APPROVED', approvalsCount };
    }

    return { status: 'PENDING', approvalsCount };
  });

  return NextResponse.json({ 
    success: true,
    message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
    status: result.status,
    approvalsCount: result.approvalsCount
  });
}