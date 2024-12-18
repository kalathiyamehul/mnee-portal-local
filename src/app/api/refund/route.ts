import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.outpoint) {
      return NextResponse.json({ error: 'Missing required field: outpoint' }, { status: 400 });
    }

    const [txid, vout] = body.outpoint.split('_');
    if (!txid || vout === undefined) {
      return NextResponse.json({ error: 'Invalid outpoint format' }, { status: 400 });
    }

    // TODO: Implement refund logic
    return NextResponse.json({ error: 'Refund functionality not yet implemented' }, { status: 400 });

  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 