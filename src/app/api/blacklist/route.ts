import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { BlacklistAction } from '@prisma/client';
import { logActivity } from "@/lib/activityLogger";

// Helper function to validate BlacklistAction
function isBlacklistAction(action: string): action is BlacklistAction {
  return Object.values(BlacklistAction).includes(action as BlacklistAction);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action, no_of_approvals, reason } = await request.json();

  // Validate input
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }
  
  if (!isBlacklistAction(action)) {
    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
  }

  try {
    // Check for existing pending request
    const existingRequest = await prisma.blacklistRequest.findFirst({
      where: {
        address,
        status: 'PENDING',
        action: action as BlacklistAction,
      },
    });

    if (existingRequest) {
      throw new Error('A pending request already exists for this address');
    }

    // Get latest status for this address
    const latestStatus = await prisma.blacklistRequest.findFirst({
      where: {
        address,
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Prevent unblacklist if not currently blacklisted
    if (action === 'UNBLACKLIST' && (!latestStatus || latestStatus.action !== 'BLACKLIST')) {
      throw new Error('Address is not currently blacklisted');
    }

    // Create the blacklist request with PENDING status and log activity
    const result = await prisma.$transaction(async (tx) => {
      // Create the blacklist request
      const blacklistRequest = await tx.blacklistRequest.create({
        data: {
          address,
          status: 'PENDING',
          action: action as BlacklistAction,
          reason,  // Add reason field
          requestedBy: session.user.id,
        },
      });

      await logActivity(tx, {
        name: "Blacklist Request Created",
        action: "BLACKLIST_REQUEST_CREATE",
        description: `A blacklist request has been created for address ${address} with action ${action}`,
        metadata: {
          blacklistRequest: JSON.stringify(blacklistRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      return blacklistRequest;
    });

    return NextResponse.json({ blacklistRequest: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating blacklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create blacklist' },
      { status: 500 }
    );
  }
}