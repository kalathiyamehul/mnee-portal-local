import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { blacklistRequestId } = await request.json();

  // Use a transaction to ensure data consistency
  const result = await prisma.$transaction(async (tx) => {
    // Verify the approving user exists
    const approvingUser = await tx.user.findUnique({
      where: { id: session.user.id }
    });

    if (!approvingUser) {
      throw new Error('Approving user not found');
    }

    // Fetch the blacklist request
    const blacklistRequest = await tx.blacklistRequest.findUnique({
      where: { id: blacklistRequestId },
      include: {
        requester: true,
        approvals: true
      },
    });

    if (!blacklistRequest) {
      throw new Error('Blacklist request not found');
    }

    if (blacklistRequest.status !== 'PENDING') {
      throw new Error('Request is not pending');
    }

    // Prevent self-approval
    if (blacklistRequest.requestedBy === session.user.id) {
      throw new Error('Cannot approve your own request');
    }

    // Check if the user has already approved
    const existingApproval = await tx.blacklistApproval.findFirst({
      where: {
        blacklistRequestId,
        approvedBy: session.user.id,
      },
    });

    if (existingApproval) {
      throw new Error('You have already approved this request');
    }

    // Create a new approval
    await tx.blacklistApproval.create({
      data: {
        blacklistRequestId,
        approvedBy: session.user.id,
      },
    });

    // Get updated approval count
    const approvalCount = await tx.blacklistApproval.count({
      where: { blacklistRequestId },
    });

    // If we now have 2 approvals (including the initial one), update the status
    if (approvalCount >= 2) {
      const updatedRequest = await tx.blacklistRequest.update({
        where: { id: blacklistRequestId },
        data: {
          status: 'APPROVED',
          updatedAt: new Date()
        },
      });

      // If there's a callback URL, trigger it
      if (blacklistRequest.callbackUrl) {
        try {
          const callbackResponse = await fetch(blacklistRequest.callbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              blacklistRequestId: updatedRequest.id,
              address: updatedRequest.address,
              action: updatedRequest.action,
              status: updatedRequest.status,
            }),
          });

          console.log('Callback response:', await callbackResponse.json());
        } catch (error) {
          console.error('Error calling callback URL:', error);
        }
      }

      return { approvalCount, status: 'APPROVED' };
    }

    return { approvalCount, status: 'PENDING' };
  });

  return NextResponse.json({
    success: true,
    message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
    approvalCount: result.approvalCount,
    status: result.status
  });
} 