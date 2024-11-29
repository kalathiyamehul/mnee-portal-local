import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { mintRequestId } = await request.json();

  const result = await prisma.$transaction(async (tx) => {
    // Fetch the mint request
    const mintRequest = await tx.mintRequest.findUnique({
      where: { id: mintRequestId },
      include: { 
        requester: true,
        approvals: true 
      },
    });

    if (!mintRequest) {
      throw new Error('Mint request not found');
    }

    if (mintRequest.status !== 'PENDING') {
      throw new Error('Request is not pending');
    }

    // Prevent self-approval
    if (mintRequest.requestedBy === session.user.id) {
      throw new Error('Cannot approve your own request');
    }

    // Check if the user has already approved
    const existingApproval = await tx.actionApproval.findFirst({
      where: {
        mintRequestId,
        approvedBy: session.user.id,
      },
    });

    if (existingApproval) {
      throw new Error('You have already approved this request');
    }

    // Create a new approval
    await tx.actionApproval.create({
      data: {
        mintRequestId,
        approvedBy: session.user.id,
      },
    });

    // Get updated approval count
    const approvalCount = await tx.actionApproval.count({
      where: { mintRequestId },
    });

    // If we now have 2 approvals (including the initial one), update the status
    if (approvalCount >= 2) {
      await tx.mintRequest.update({
        where: { id: mintRequestId },
        data: { 
          status: 'APPROVED',
          updatedAt: new Date()
        },
      });

      // Mock minting transaction - in production, call the actual minting service
      const mockMinterTx = `${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

      return { approvalCount, status: 'APPROVED', minterTx: mockMinterTx };
    }

    return { approvalCount, status: 'PENDING' };
  });

  return NextResponse.json({ 
    success: true, 
    message: result.status === 'APPROVED' ? 'Request approved' : 'Approval recorded',
    approvalCount: result.approvalCount,
    status: result.status,
    minterTx: result.minterTx
  });
} 