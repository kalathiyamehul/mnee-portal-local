// src/app/api/freezeList/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { ActionStatus, FreezeRequestAction } from '@prisma/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includePending = searchParams.get('includePending') === 'true';
  
  console.log('includePending:', includePending);

  const freezeRequests = await prisma.freezeRequest.findMany({
    where: {
      action: 'FREEZE' as FreezeRequestAction,
      ...(includePending ? {} : { status: 'APPROVED' as ActionStatus }),
    },
    include: { 
      requester: true,
      approvals: {
        include: {
          approver: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  console.log('Found freeze requests:', freezeRequests);

  return NextResponse.json({ activeFreezes: freezeRequests });
}