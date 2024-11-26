// src/app/api/approveFreeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { freezeRequestId } = await request.json();

  // Fetch the freeze request
  const freezeRequest = await prisma.freezeRequest.findUnique({
    where: { id: freezeRequestId },
    include: { approvals: true },
  });

  if (!freezeRequest || freezeRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Invalid or already processed request' }, { status: 400 });
  }

  // Check if the user has already approved
  const existingApproval = await prisma.actionApproval.findFirst({
    where: {
      freezeRequestId,
      approvedBy: session.user.id,
    },
  });

  if (existingApproval) {
    return NextResponse.json({ error: 'You have already approved this request' }, { status: 400 });
  }

  // Create a new approval
  await prisma.actionApproval.create({
    data: {
      freezeRequestId,
      approvedBy: session.user.id,
    },
  });

  // Check approval count (e.g., requires 2 approvals)
  const approvalsCount = await prisma.actionApproval.count({
    where: { freezeRequestId },
  });

  if (approvalsCount >= 2) {
    // Update freeze request status to APPROVED
    await prisma.freezeRequest.update({
      where: { id: freezeRequestId },
      data: { status: 'APPROVED' },
    });

    // TODO: Implement logic to perform the freeze/unfreeze action
  }

  return NextResponse.json({ success: true }, { status: 200 });
}