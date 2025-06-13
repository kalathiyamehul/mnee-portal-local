// src/app/api/approve/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { isSystemPaused } from '@/lib/systemStatus';
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from '@/lib/csrf';
import { getConfig } from '@/lib/config';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';
import { emitSystemUpdate } from '@/lib/sseEmitter';

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);
  const config = await getConfig();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { actionRequestId } = await request.json();

  try {
    let newAppeovalID: string;
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

      // Check if system is paused, but only if this is not a RESUME request
      if (actionRequest.action !== 'RESUME') {
        const isPaused = await isSystemPaused(tx);
        if (isPaused) {
          throw new Error("System is paused. Cannot approve system requests at this time.");
        }
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
      const approval = await tx.actionApproval.create({
        data: {
          actionRequestId,
          approvedBy: session.user.id,
        },
      });

      newAppeovalID = approval.id;

      await logActivity(tx, {
        action: ActivityAction.SYSTEM_ACTION_REQUEST_APPROVE,
        metadata: {
          actionRequestId,
          approverId: session.user.id,
        },
      });

      // Check approval count (requires exactly minimum Threshold approvals)
      const approvalsCount = await tx.actionApproval.count({
        where: { actionRequestId },
      });

      if (approvalsCount === config?.minNoOfApproval) {
        await tx.actionRequest.update({
          where: { id: actionRequestId },
          data: { 
            status: 'APPROVED',
            updatedAt: new Date(),
          },
        });

        await logActivity(tx, {
          action: ActivityAction.SYSTEM_ACTION_REQUEST_FULLY_APPROVED,
          metadata: {
            actionRequestId,
            approvalsCount,
          },
        });

        emitSystemUpdate({
          activityId: actionRequestId,
          type: "APPROVED",
        })
        return { status: 'APPROVED', approvalsCount };
      }

      return { status: 'PENDING', approvalsCount };
    });

    // emit Freeze Approve event
		const approvalWithUser = await prisma.actionApproval.findUnique({
			where: {
				id: newAppeovalID!,
			},
			include: {
				approver: true,
			},
		});
		emitSystemUpdate({
			activityId: actionRequestId,
			approval: approvalWithUser,
			type: "APPROVE",
		});

    return NextResponse.json({ 
      success: true,
      message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
      status: result.status,
      approvalsCount: result.approvalsCount
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process approval',
    }, { status: 500 });
  }
}, createAPIRateLimit())