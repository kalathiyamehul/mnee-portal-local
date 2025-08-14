import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { performSystemChecks, SystemOperation } from '@/lib/systemStatus';
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from '@/lib/csrf';
import { emitRestrictionsUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

export const POST = withCSRF(async function (request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { blacklistRequestId } = await request.json();

  if (!blacklistRequestId) {
    return NextResponse.json({ error: 'Blacklist request ID is required' }, { status: 400 });
  }

  try {
    let newAppeovalID: string;
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
        throw new Error('This request is no longer pending');
      }

      // Check if system is paused
      console.log('Checking system status');
      const systemCheck = await performSystemChecks(tx, {
        address: blacklistRequest.address,
        operation: SystemOperation.BLACKLIST_REQUEST_APPROVE
      });
      if (!systemCheck.isValid) {
        console.log('System check failed:', systemCheck.error);
        throw new Error(systemCheck.error);
      }

      // Prevent self-approval
      if (blacklistRequest.requester.id === session.user.id) {
        throw new Error('You cannot approve your own request');
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
      const approval = await tx.blacklistApproval.create({
        data: {
          blacklistRequestId,
          approvedBy: session.user.id,
        },
      });

      newAppeovalID = approval.id;

      await logActivity(tx, {
        action: blacklistRequest.action === 'UNBLACKLIST' ? ActivityAction.UNBLACKLIST_REQUEST_APPROVE : ActivityAction.BLACKLIST_REQUEST_APPROVE,
        metadata: {
          blacklistRequestId,
          address: blacklistRequest.address,
          blacklistRequest: JSON.stringify(blacklistRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          approval: JSON.stringify(approval, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      // Get updated approvals count
      const approvals = await tx.blacklistApproval.count({
        where: { blacklistRequestId },
      });

      // Update status if we have enough approvals
      if (approvals === blacklistRequest.no_of_approvals) {
        await tx.blacklistRequest.update({
          where: { id: blacklistRequestId },
          data: {
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });

        emitRestrictionsUpdate({
          activityId: blacklistRequestId,
          approval: 'Blacklist Request Fully Approved',
          type: "APPROVED_BLACKLIST",
        });

        await logActivity(tx, {
          action: blacklistRequest.action === 'UNBLACKLIST' ? ActivityAction.UNBLACKLIST_REQUEST_FULLY_APPROVED : ActivityAction.BLACKLIST_REQUEST_FULLY_APPROVED,
          metadata: {
            address: blacklistRequest.address,
            blacklistRequestId: blacklistRequestId,
            approvals: approvals,
          },
        });
      }

      return { approvals, status: approvals === 2 ? 'APPROVED' : 'PENDING' };
    });

    // emit Blacklist Approve event
    const approvalWithUser = await prisma.blacklistApproval.findUnique({
      where: {
        id: newAppeovalID!,
      },
      include: {
        approver: true,
      },
    });
    emitRestrictionsUpdate({
      activityId: blacklistRequestId,
      approval: approvalWithUser,
      type: "APPROVE_BLACKLIST",
    });

    return NextResponse.json({
      success: true,
      message: "Request approved",
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
}, createAPIRateLimit())