// src/app/api/freeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { FreezeAction } from '@prisma/client';

// Helper function to validate FreezeAction
function isFreezeAction(action: string): action is FreezeAction {
  console.log('FreezeAction enum:', FreezeAction);
  console.log('FreezeAction values:', Object.values(FreezeAction));
  console.log('Checking action:', action);
  const isValid = Object.values(FreezeAction).includes(action as FreezeAction);
  console.log('Is valid action?', isValid);
  return isValid;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action, callbackUrl } = await request.json();
  console.log('Received request:', { address, action, callbackUrl });

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
        action: action as FreezeAction,
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
    if (action === 'UNBLACKLIST' && (!latestStatus || latestStatus.action !== 'BLACKLIST')) {
      throw new Error('Address is not currently blacklisted');
    }
    if (action === 'UNFREEZE' && (!latestStatus || latestStatus.action !== 'FREEZE')) {
      throw new Error('Address is not currently frozen');
    }

    // Determine if approval is required based on action
    const requiresApproval = !['BLACKLIST', 'UNBLACKLIST'].includes(action);

    // Create the freeze request
    const freezeRequest = await tx.freezeRequest.create({
      data: {
        address,
        action: action as FreezeAction,
        requestedBy: session.user.id,
        callbackUrl,
        status: requiresApproval ? 'PENDING' : 'APPROVED',
        requiresApproval,
      },
    });

    // Create initial approval from the requester if approval is required
    if (requiresApproval) {
      await tx.actionApproval.create({
        data: {
          freezeRequestId: freezeRequest.id,
          approvedBy: session.user.id,
        },
      });
    }

    // If no approval required (blacklist actions), trigger callback immediately
    if (!requiresApproval && callbackUrl) {
      try {
        await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            freezeRequestId: freezeRequest.id,
            address: freezeRequest.address,
            action: freezeRequest.action,
            status: freezeRequest.status,
          }),
        });
      } catch (error) {
        console.error('Error calling callback URL:', error);
      }
    }

    return freezeRequest;
  });

  return NextResponse.json({ freezeRequest: result }, { status: 201 });
}
