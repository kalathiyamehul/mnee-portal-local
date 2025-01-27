// src/app/api/cancel/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { actionRequestId, freezeRequestId, blacklistRequestId, mintRequestId, burnRequestId, refundRequestId } = await request.json();

  try {
    if (actionRequestId) {
      const request = await prisma.actionRequest.findUnique({
        where: { id: actionRequestId },
      });

      if (!request) {
        return NextResponse.json({ error: 'Action request not found' }, { status: 404 });
      }

      if (request.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
      }

      await prisma.actionRequest.update({
        where: { id: actionRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (freezeRequestId) {
      const request = await prisma.freezeRequest.findUnique({
        where: { id: freezeRequestId },
      });

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      await prisma.freezeRequest.update({
        where: { id: freezeRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (blacklistRequestId) {
      const request = await prisma.blacklistRequest.findUnique({
        where: { id: blacklistRequestId },
      });

      if (!request) {
        return NextResponse.json(
          { error: 'Blacklist request not found' },
          { status: 404 }
        );
      }

      await prisma.blacklistRequest.update({
        where: { id: blacklistRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (mintRequestId) {
      const request = await prisma.mintRequest.findUnique({
        where: { id: mintRequestId },
      });

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      await prisma.mintRequest.update({
        where: { id: mintRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (burnRequestId) {
      const request = await prisma.burnRequest.findUnique({
        where: { id: burnRequestId },
      });

      if (!request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
      }

      if (request.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      await prisma.burnRequest.update({
        where: { id: burnRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (refundRequestId) {
      const request = await prisma.refundRequest.findUnique({
        where: { id: refundRequestId },
      });

      if (!request) {
        return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
      }

      if (request.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'You can only cancel your own requests' }, { status: 403 });
      }

      await prisma.refundRequest.update({
        where: { id: refundRequestId },
        data: { status: 'CANCELLED' },
      });
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling request:', error);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}