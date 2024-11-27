// src/app/api/freeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import type { FreezeAction } from '@prisma/client';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action, callbackUrl } = await request.json();

  // Validate input
  if (!address || !['FREEZE', 'UNFREEZE'].includes(action)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Use transaction to create both request and initial approval
  const result = await prisma.$transaction(async (tx) => {
    // Check for existing pending request
    const existingRequest = await tx.freezeRequest.findFirst({
      where: {
        address,
        action: action as FreezeAction,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new Error('A request is already pending for this address and action');
    }

    // Create the freeze request
    const freezeRequest = await tx.freezeRequest.create({
      data: {
        address,
        action: action as FreezeAction,
        requestedBy: session.user.id,
        callbackUrl,
        status: 'PENDING'
      },
    });

    // Create initial approval from the requester
    await tx.actionApproval.create({
      data: {
        freezeRequestId: freezeRequest.id,
        approvedBy: session.user.id,
      },
    });

    return freezeRequest;
  });

  return NextResponse.json({ freezeRequest: result }, { status: 201 });
}
