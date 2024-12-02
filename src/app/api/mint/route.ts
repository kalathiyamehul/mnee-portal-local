import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

// interface FundingUtxo {
//   txid: string;
//   vout: number;
//   locking_script: string;
//   satoshis: number;
// }

// interface MintRequest {
//   amount: number;
//   latest_minter_tx?: string;
//   token_ls: string;
//   funding_utxos?: FundingUtxo[];
//   fee_per_kb?: number;
//   change_address?: string;
// }

interface MintRequestParams {
  amount: number;
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
    if (!body.amount || !body.address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create mint request in database with initial approval
    const result = await prisma.$transaction(async (tx) => {
      // Create the mint request
      const mintRequest = await tx.mintRequest.create({
        data: {
          address: body.address,
          amount: body.amount,
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

    return NextResponse.json({ mintRequest: result }, { status: 201 });
  } catch (error) {
    console.error('Error processing mint request:', error);
    return NextResponse.json({ error: 'Failed to process mint request' }, { status: 500 });
  }
} 