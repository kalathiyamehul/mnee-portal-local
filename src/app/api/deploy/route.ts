import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { symbol, amount, destinationAddress, decimals } = await request.json();

    if (!symbol || !amount || !destinationAddress || decimals === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call the MNEE service to deploy the token
    const response = await fetch(`${process.env.MNEE_ORDINALS_SERVICE}/deploy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        symbol,
        amount,
        destinationAddress,
        decimals,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to deploy token: ${error}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deploying token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to deploy token' },
      { status: 500 }
    );
  }
} 