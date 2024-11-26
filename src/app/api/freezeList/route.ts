// src/app/api/freezeList/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  // Get approved freeze requests
  const activeFreezes = await prisma.freezeRequest.findMany({
    where: {
      status: 'APPROVED',
      action: 'FREEZE',
    },
    include: { requester: true },
  });

  return NextResponse.json({ activeFreezes }, { status: 200 });
}