import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { BlacklistAction } from '@prisma/client';

// Helper function to validate BlacklistAction
function isBlacklistAction(action: string): action is BlacklistAction {
  return Object.values(BlacklistAction).includes(action as BlacklistAction);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action } = await request.json();
  console.log('Received blacklist request:', { address, action });

  // Validate input
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }
  
  if (!isBlacklistAction(action)) {
    console.log('Invalid action:', action);
    return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
  }

  try {
    // Check for existing pending request
    const existingRequest = await prisma.blacklist.findFirst({
      where: {
        address,
        action: action as BlacklistAction,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new Error('A request is already pending for this address and action');
    }

    // Get the latest approved status for this address
    const latestStatus = await prisma.blacklist.findFirst({
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

    // Create the blacklist entry (auto-approved)
    const blacklist = await prisma.blacklist.create({
      data: {
        address,
        action: action as BlacklistAction,
        requestedBy: session.user.id,
        status: 'APPROVED',
      },
    });

    // If there's a callback URL, trigger it immediately since blacklist actions are auto-approved
    // if (callbackUrl) {
    //   try {
    //     await fetch(callbackUrl, {
    //       method: 'POST',
    //       headers: {
    //         'Content-Type': 'application/json',
    //       },
    //       body: JSON.stringify({
    //         blacklistId: blacklist.id,
    //         address: blacklist.address,
    //         action: blacklist.action,
    //         status: blacklist.status,
    //       }),
    //     });
    //   } catch (error) {
    //     console.error('Error calling callback URL:', error);
    //   }
    // }

    return NextResponse.json({ blacklist }, { status: 201 });
  } catch (error) {
    console.error('Error creating blacklist:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create blacklist' },
      { status: 500 }
    );
  }
} 