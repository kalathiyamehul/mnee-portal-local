// src/app/api/cancel/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { actionRequestId } = await request.json();

  // Fetch the action request
  const actionRequest = await prisma.actionRequest.findUnique({
    where: { id: actionRequestId },
  });

  if (!actionRequest || actionRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Invalid action request' }, { status: 400 });
  }

  if (actionRequest.requestedBy !== session.user.id) {
    return NextResponse.json({ error: 'You cannot cancel this request' }, { status: 403 });
  }

  // Update the status to CANCELLED
  await prisma.actionRequest.update({
    where: { id: actionRequestId },
    data: { status: 'CANCELLED' },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}