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

  if (!blacklistRequestId) {
    return NextResponse.json({ error: 'Blacklist request ID is required' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      console.log('Processing blacklist approval:', {
        requestId: blacklistRequestId,
        approvingUserId: session.user.id
      });

      // Get the blacklist request
      const blacklistRequest = await tx.blacklistRequest.findUnique({
        where: { id: blacklistRequestId },
        include: {
          approvals: {
            include: {
              approver: {
                select: {
                  id: true,
                  email: true
                }
              }
            }
          },
          requester: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      console.log('Found blacklist request:', {
        request: {
          ...blacklistRequest,
          approvals: blacklistRequest?.approvals.map(a => ({
            approverId: a.approvedBy,
            approverEmail: a.approver.email,
            timestamp: a.createdAt
          }))
        }
      });

      if (!blacklistRequest) {
        throw new Error('Blacklist request not found');
      }

      if (blacklistRequest.status !== 'PENDING') {
        throw new Error('Request is not pending');
      }

      // Prevent self-approval
      if (blacklistRequest.requestedBy === session.user.id) {
        console.log('Self-approval attempt blocked:', {
          requesterId: blacklistRequest.requestedBy,
          approverId: session.user.id
        });
        throw new Error('Cannot approve your own request');
      }

      // Check if user has already approved
      const existingApproval = await tx.blacklistApproval.findFirst({
        where: {
          blacklistRequestId,
          approvedBy: session.user.id,
        },
      });

      if (existingApproval) {
        console.log('Duplicate approval attempt blocked:', {
          requestId: blacklistRequestId,
          approverId: session.user.id
        });
        throw new Error('You have already approved this request');
      }

      // Create approval
      await tx.blacklistApproval.create({
        data: {
          blacklistRequestId,
          approvedBy: session.user.id,
        },
      });

      // Get updated approvals count
      const approvals = await tx.blacklistApproval.count({
        where: { blacklistRequestId },
      });

      console.log('Current approval count:', {
        requestId: blacklistRequestId,
        approvalCount: approvals,
        requiresApproval: blacklistRequest.requiresApproval
      });

      // Update status if we have enough approvals
      if (approvals >= 2) {
        console.log('Approving blacklist request:', {
          requestId: blacklistRequestId,
          approvalCount: approvals,
          action: blacklistRequest.action
        });

        await tx.blacklistRequest.update({
          where: { id: blacklistRequestId },
          data: { 
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });
      }

      return { approvals, status: approvals >= 2 ? 'APPROVED' : 'PENDING' };
    });

    return NextResponse.json({
      success: true,
      message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
      approvalCount: result.approvals,
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