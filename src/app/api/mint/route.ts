import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { toTokenSat } from 'satoshi-token';
import { getConfig } from '@/lib/config';

interface MintRequestParams {
  amount: string;
  customerId: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: MintRequestParams = await request.json();
    
    // Validate required fields
    if (!body?.amount || !body?.customerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Look up customer to get their address
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const config = await getConfig();
    if (!config) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 });
    }

    // Convert amount to satoshis
    const amountSat = toTokenSat(body.amount, config.decimals);

    // Create mint request in database with initial approval
    const result = await prisma.$transaction(async (tx) => {
      // Create the mint request
      const mintRequest = await tx.mintRequest.create({
        data: {
          address: customer.address,
          amount: amountSat,
          requestedBy: session.user.id,
          status: 'PENDING',
          requiresApproval: true,
          customerId: customer.id,
        },
        include: {
          customer: true
        }
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

    return NextResponse.json({ 
      mintRequest: {
        ...result,
        amount: result.amount.toString()
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing mint request:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to process mint request' 
    }, { status: 500 });
  }
} 