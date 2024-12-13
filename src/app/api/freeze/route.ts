// src/app/api/freeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { FreezeRequestAction } from '@prisma/client';

// Helper function to validate FreezeRequestAction
function isFreezeAction(action: string): action is FreezeRequestAction {
  return Object.values(FreezeRequestAction).includes(action as FreezeRequestAction);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action } = await request.json();
  console.log('Received freeze request:', { address, action });

  // Validate input
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }
  
  if (!isFreezeAction(action)) {
    console.log('Invalid action:', action);
    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
  }

  // Use transaction to create both request and initial approval
  const result = await prisma.$transaction(async (tx) => {
    // Check for existing pending request
    const existingRequest = await tx.freezeRequest.findFirst({
      where: {
        address,
        action: action as FreezeRequestAction,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new Error('A request is already pending for this address and action');
    }

    // Get the latest approved status for this address
    const latestStatus = await tx.freezeRequest.findFirst({
      where: {
        address,
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Validate based on action type
    if (action === 'UNFREEZE' && (!latestStatus || latestStatus.action !== 'FREEZE')) {
      throw new Error('Address is not currently frozen');
    }

    // Create the freeze request
    const freezeRequest = await tx.freezeRequest.create({
      data: {
        address,
        action: action as FreezeRequestAction,
        requestedBy: session.user.id,
        status: 'PENDING',
        requiresApproval: true,
      },
    });

    // Create initial approval from the requester
    await tx.freezeApproval.create({
      data: {
        freezeRequestId: freezeRequest.id,
        approvedBy: session.user.id,
      },
    });

    return freezeRequest;
  });

  return NextResponse.json({ freezeRequest: result }, { status: 201 });
}
