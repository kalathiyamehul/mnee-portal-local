import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { toTokenSat } from 'satoshi-token';
import { DEFAULT_DECIMALS } from '@/lib/constants';
import { getConfig } from '@/lib/config';

interface MintRequestParams {
  amount: string;
  address: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: MintRequestParams = await request.json();
    
    // Validate required fields
    if (!body?.amount || !body?.address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const config = await getConfig();
    if (!config) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 });
    }

    // Create mint request in database with initial approval
    const result = await prisma.$transaction(async (tx) => {
      // Create the mint request
      const mintRequest = await tx.mintRequest.create({
        data: {
          address: body.address,
          amount: toTokenSat(body.amount, config.decimals),
          requestedBy: session.user.id,
          status: 'PENDING',
          requiresApproval: true,
        },
      });

      // Create initial approval from the requester
      await tx.actionApproval.create({
        data: {
          mintRequestId: mintRequest.id,
          approvedBy: session.user.id,
        },
      });

      return mintRequest;
    });

    if (!result) {
      throw new Error('Failed to create mint request');
    }

    return NextResponse.json({ mintRequest: result }, { status: 201 });
  } catch (error) {
    console.error('Error processing mint request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process mint request' 
    }, { status: 500 });
  }
} 