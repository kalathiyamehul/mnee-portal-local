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

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { address, action } = await request.json();

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    if (!action || !isFreezeAction(action)) {
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
      return NextResponse.json(
        { error: "There is already a pending freeze request for this address" },
        { status: 400 }
      );
    }

    // Check if system is paused
    const pauseRequest = await prisma.actionRequest.findFirst({
      where: {
        action: 'PAUSE',
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const resumeRequest = await prisma.actionRequest.findFirst({
      where: {
        action: 'RESUME',
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // System is paused if the latest approved PAUSE is more recent than the latest approved RESUME
    const isPaused = pauseRequest && (!resumeRequest || pauseRequest.createdAt > resumeRequest.createdAt);

    if (isPaused) {
      return NextResponse.json(
        { error: "System is paused. Cannot create freeze requests at this time." },
        { status: 400 }
      );
    }

    // Create the freeze request and initial approval in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the freeze request
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

      // Create initial approval from requester
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

      return { request, approval };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in freeze request:', error instanceof Error ? {
      message: error.message,
      stack: error.stack
    } : error);
    
    // Extract the relevant error message
    let message = "Failed to process freeze request";
    if (error instanceof Error) {
      // If it's a Prisma error, it will contain the word "prisma" in lowercase
      if (error.message.toLowerCase().includes('prisma')) {
        // Extract just the last line which usually contains the actual error
        const lines = error.message.split('\n');
        message = lines[lines.length - 1].trim();
      } else {
        message = error.message;
      }
    }
    
    return NextResponse.json(
      { message },
      { status: 500 }
    );
  }
}
