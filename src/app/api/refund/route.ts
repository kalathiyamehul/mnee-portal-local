import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
  try {
    console.log('Refund request received');
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log('Unauthorized refund attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Refund request body:', body);

    if (!body.outpoint) {
      console.log('Invalid refund request - missing outpoint:', body);
      return NextResponse.json({ error: 'Missing required field: outpoint' }, { status: 400 });
    }

    const [txid, vout] = body.outpoint.split('_');
    if (!txid || vout === undefined) {
      console.log('Invalid outpoint format:', body.outpoint);
      return NextResponse.json({ error: 'Invalid outpoint format' }, { status: 400 });
    }

    // TODO: Implement refund logic
    console.log('Processing refund for:', { txid, vout: parseInt(vout, 10) });
    return NextResponse.json({ error: 'Refund functionality not yet implemented' }, { status: 400 });

  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 