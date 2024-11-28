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

  const { actionRequestId, freezeRequestId } = await request.json();

  try {
    if (actionRequestId) {
      // Cancel action request
      const actionRequest = await prisma.actionRequest.findUnique({
        where: { id: actionRequestId },
      });

      if (!actionRequest) {
        return NextResponse.json({ error: 'Action request not found' }, { status: 404 });
      }

      if (actionRequest.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'Only the creator can cancel this request' }, { status: 403 });
      }

      await prisma.actionRequest.update({
        where: { id: actionRequestId },
        data: { status: 'CANCELLED' },
      });
    } else if (freezeRequestId) {
      // Cancel freeze request
      const freezeRequest = await prisma.freezeRequest.findUnique({
        where: { id: freezeRequestId },
      });

      if (!freezeRequest) {
        return NextResponse.json({ error: 'Freeze request not found' }, { status: 404 });
      }

      if (freezeRequest.requestedBy !== session.user.id) {
        return NextResponse.json({ error: 'Only the creator can cancel this request' }, { status: 403 });
      }

      await prisma.freezeRequest.update({
        where: { id: freezeRequestId },
        data: { status: 'CANCELLED' },
      });
    } else {
      return NextResponse.json({ error: 'No request ID provided' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling request:', error);
    return NextResponse.json({ error: 'Failed to cancel request' }, { status: 500 });
  }
}