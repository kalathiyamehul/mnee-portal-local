import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { blacklistId } = await request.json();

  if (!blacklistId) {
    return NextResponse.json({ error: 'Blacklist ID is required' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get the blacklist request
      const blacklistRequest = await tx.blacklist.findUnique({
        where: { id: blacklistId },
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

      // Check if user has already approved
      const existingApproval = await tx.blacklistApproval.findFirst({
        where: {
          blacklistId,
          approvedBy: session.user.id,
        },
      });

      if (existingApproval) {
        throw new Error('You have already approved this request');
      }

      // Create a new approval
      await tx.blacklistApproval.create({
        data: {
          blacklistId,
          approvedBy: session.user.id,
        },
      });

      // Get updated approval count
      const approvalCount = await tx.blacklistApproval.count({
        where: { blacklistId },
      });

      // If we now have 2 approvals (including the initial one), update the status
      if (approvalCount >= 2) {
        await tx.blacklist.update({
          where: { id: blacklistId },
          data: {
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });

        return { approvalCount, status: 'APPROVED' };
      }

      return { approvalCount, status: 'PENDING' };
    });

    return NextResponse.json({
      success: true,
      message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
      approvalCount: result.approvalCount,
      status: result.status,
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process approval',
    }, { status: 500 });
  }
} 