// src/app/api/approve/route.ts
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
    include: { approvals: true },
  });

  if (!actionRequest || actionRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Invalid or already processed action request' }, { status: 400 });
  }

  // Check if the user has already approved
  const existingApproval = await prisma.actionApproval.findFirst({
    where: {
      actionRequestId,
      approvedBy: session.user.id,
    },
  });

  if (existingApproval) {
    return NextResponse.json({ error: 'You have already approved this request' }, { status: 400 });
  }

  // Create a new approval
  await prisma.actionApproval.create({
    data: {
      actionRequestId,
      approvedBy: session.user.id,
    },
  });

  // Check approval count (e.g., requires 2 approvals)
  const approvalsCount = await prisma.actionApproval.count({
    where: { actionRequestId },
  });

  if (approvalsCount >= 2) {
    // Update action request status to APPROVED
    await prisma.actionRequest.update({
      where: { id: actionRequestId },
      data: { status: 'APPROVED' },
    });

    // TODO: Implement logic to perform the pause or resume action
  }

  return NextResponse.json({ success: true }, { status: 200 });
}