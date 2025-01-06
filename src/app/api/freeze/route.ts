// src/app/api/freeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { FreezeRequestAction } from '@prisma/client';
import { isSystemPaused } from '@/lib/systemStatus';

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

    // Check if system is paused
    const isPaused = await isSystemPaused(prisma);
    if (isPaused) {
      return NextResponse.json(
        { error: "System is paused. Cannot create freeze requests at this time." },
        { status: 400 }
      );
    }

    // Check if there's already a pending request for this address
    const pendingRequest = await prisma.freezeRequest.findFirst({
      where: {
        address,
        status: 'PENDING',
      },
    });

    if (pendingRequest && pendingRequest.action === action) {
      return NextResponse.json(
        { error: `There is already a pending ${action.toLowerCase()} request for this address` },
        { status: 400 }
      );
    }

    // Get all approved freeze/unfreeze requests for this address
    const approvedRequests = await prisma.freezeRequest.findMany({
      where: {
        address,
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // The current state is determined by the most recent approved action
    const isFrozen = approvedRequests[0]?.action === 'FREEZE';

    if (action === 'FREEZE' && isFrozen) {
      return NextResponse.json(
        { error: "This address is already frozen" },
        { status: 400 }
      );
    }

    if (action === 'UNFREEZE' && !isFrozen) {
      return NextResponse.json(
        { error: "This address is not frozen" },
        { status: 400 }
      );
    }

    // Create the freeze request
    const result = await prisma.$transaction(async (tx) => {
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

      return { request };
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
