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
  try {
    const session = await getServerSession(authOptions);
    console.log('Session:', { userId: session?.user?.id });

    if (!session?.user?.id) {
      console.log('Unauthorized: No session or user ID');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address, action } = await request.json();
    console.log('Request payload:', { address, action });

    if (!address) {
      console.log('Missing address in request');
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    if (!action || !isFreezeAction(action)) {
      console.log('Invalid action:', { action });
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Check if there's already a pending request for this address
    const pendingRequest = await prisma.freezeRequest.findFirst({
      where: {
        address,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      console.log('Found existing pending request:', pendingRequest);
      return NextResponse.json(
        { error: "There is already a pending freeze request for this address" },
        { status: 400 }
      );
    }

    console.log('Starting transaction for freeze request');
    // Create the freeze request and initial approval in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the freeze request
      console.log('Creating freeze request:', { address, action, userId: session.user.id });
      const request = await tx.freezeRequest.create({
        data: {
          address,
          action,
          status: 'PENDING',
          requester: {
            connect: {
              id: session.user.id
            }
          }
        },
        include: {
          requester: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      console.log('Created freeze request:', request);

      // Create initial approval from requester
      console.log('Creating initial approval:', { freezeRequestId: request.id, userId: session.user.id });
      const approval = await tx.freezeApproval.create({
        data: {
          freezeRequestId: request.id,
          approvedBy: session.user.id,
        },
        include: {
          approver: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      console.log('Created initial approval:', approval);
      console.log('Transaction completed successfully');

      return { request, approval };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.log('Error in freeze request:', error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process freeze request" },
      { status: 500 }
    );
  }
}
