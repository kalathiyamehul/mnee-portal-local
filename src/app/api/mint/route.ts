import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

interface FundingUtxo {
  txid: string;
  vout: number;
  locking_script: string;
  satoshis: number;
}

interface MintRequest {
  amount: number;
  latest_minter_tx?: string;
  token_ls: string;
  funding_utxos?: FundingUtxo[];
  fee_per_kb?: number;
  change_address?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: MintRequest = await request.json();
    
    // Validate required fields
    if (!body.amount || !body.token_ls) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create mint request in database
    await prisma.mintRequest.create({
      data: {
        address: body.token_ls,
        amount: body.amount,
        requestedBy: session.user.id,
        latestMinterTx: body.latest_minter_tx,
        status: 'PENDING',
      },
    });

    // Mock response - in reality this would come from the minting service
    const mockMinterTx = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');

    // In production, we would call the actual minting service here
    // For now, just return a mock transaction
    return NextResponse.json({
      minter_tx: mockMinterTx,
    });
  } catch (error) {
    console.error('Error processing mint request:', error);
    return NextResponse.json({ error: 'Failed to process mint request' }, { status: 500 });
  }
} 