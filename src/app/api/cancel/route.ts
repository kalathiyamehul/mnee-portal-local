// src/app/api/cancel/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { logActivity } from '@/lib/activityLogger';
import { withCSRF } from '@/lib/csrf';
import { emitCancelUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';

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
          name: "Action Request Cancelled",
          action: "ACTION_REQUEST_CANCEL",
          description: `Action request ${actionRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Freeze Request Cancelled",
          action: "FREEZE_REQUEST_CANCEL",
          description: `Freeze request ${freezeRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Blacklist Request Cancelled",
          action: "BLACKLIST_REQUEST_CANCEL",
          description: `Blacklist request ${blacklistRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Mint Request Cancelled",
          action: "MINT_REQUEST_CANCEL",
          description: `Mint request ${mintRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Burn Request Cancelled",
          action: "BURN_REQUEST_CANCEL",
          description: `Burn request ${burnRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Customer Request Cancelled",
          action: "CUSTOMER_REQUEST_CANCEL",
          description: `Customer request ${customerRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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
          name: "Refund Request Cancelled",
          action: "REFUND_REQUEST_CANCEL",
          description: `Refund request ${refundRequestId} cancelled by user ${session.user.id}`,
          metadata: {
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