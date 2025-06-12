// src/app/api/cancel/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { ActivityAction, logActivity } from '@/lib/activityLogger';
import { withCSRF } from '@/lib/csrf';
import { emitCancelUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';
import Email from 'next-auth/providers/email';

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { actionRequestId, freezeRequestId, blacklistRequestId, mintRequestId, burnRequestId, refundRequestId, customerRequestId } = await request.json();
  try {
    if (actionRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.actionRequest.findUnique({
          where: { id: actionRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Action request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
        }

        const updated = await tx.actionRequest.update({
          where: { id: actionRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.ACTION_REQUEST_CANCEL,
          metadata: {
            actionRequestId,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (freezeRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.freezeRequest.findUnique({
          where: { id: freezeRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updated = await tx.freezeRequest.update({
          where: { id: freezeRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.FREEZE_REQUEST_CANCEL,
          metadata: {
            freezeRequestId,
            address: request.address,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (blacklistRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.blacklistRequest.findUnique({
          where: { id: blacklistRequestId },
        });

        if (!request) {
          return NextResponse.json(
            { error: 'Blacklist request not found' },
            { status: 404 }
          );
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
        }

        const updated = await tx.blacklistRequest.update({
          where: { id: blacklistRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.BLACKLIST_REQUEST_CANCEL,
          metadata: {
            blacklistRequestId,
            address: request.address,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (mintRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.mintRequest.findUnique({
          where: { id: mintRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updated = await tx.mintRequest.update({
          where: { id: mintRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.MINT_REQUEST_CANCEL,
          metadata: {
            mintRequestId,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (burnRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.burnRequest.findUnique({
          where: { id: burnRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updated = await tx.burnRequest.update({
          where: { id: burnRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.BURN_REQUEST_CANCEL,
          metadata: {
            burnRequestId,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (customerRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.customerRequest.findUnique({
          where: { id: customerRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const updated = await tx.customerRequest.update({
          where: { id: customerRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.CUSTOMER_REQUEST_CANCEL,
          metadata: {
            customerRequestId,
            customerEmail: request.email,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else if (refundRequestId) {
      const result = await prisma.$transaction(async (tx) => {
        const request = await tx.refundRequest.findUnique({
          where: { id: refundRequestId },
        });

        if (!request) {
          return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
        }

        if (request.requestedBy !== session.user.id) {
          return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
        }

        const updated = await tx.refundRequest.update({
          where: { id: refundRequestId },
          data: { status: 'CANCELLED' },
        });

        await logActivity(tx, {
          action: ActivityAction.REFUND_REQUEST_CANCEL,
          metadata: {
            refundRequestId,
            request: JSON.stringify(updated, (key, value) =>
              typeof value === 'bigint' ? value.toString() : value
            ),
          },
        });

        return updated;
      });
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    emitCancelUpdate({
      ...(actionRequestId && { actionRequestId }),
      ...(freezeRequestId && { freezeRequestId }),
      ...(blacklistRequestId && { blacklistRequestId }),
      ...(mintRequestId && { mintRequestId }),
      ...(burnRequestId && { burnRequestId }),
      ...(refundRequestId && { refundRequestId }),
      ...(customerRequestId && { customerRequestId }),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling request:', error);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}, createAPIRateLimit())