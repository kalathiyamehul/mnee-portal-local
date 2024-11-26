// src/app/api/freeze/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, action } = await request.json();

  // Validate input
  if (!address || !['FREEZE', 'UNFREEZE'].includes(action)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  // Check for existing pending request on the same address and action
  const existingRequest = await prisma.freezeRequest.findFirst({
    where: {
      address,
      action,
      status: 'PENDING',
    },
  });

  if (existingRequest) {
    return NextResponse.json({ error: 'A request is already pending for this address and action' }, { status: 400 });
  }

  // Create a new freeze/unfreeze request
  const freezeRequest = await prisma.freezeRequest.create({
    data: {
      address,
      action,
      requestedBy: session.user.id,
    },
  });

  return NextResponse.json({ freezeRequest }, { status: 201 });
}