import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { isSystemPaused } from '@/lib/systemStatus';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { address, amount, customerId } = await request.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if system is paused
      const isPaused = await isSystemPaused(tx);
      if (isPaused) {
        throw new Error("System is paused. Cannot create mint requests at this time.");
      }

      // Check if address is blacklisted
      const blacklistRequest = await tx.blacklistRequest.findFirst({
        where: {
          address,
          status: 'APPROVED',
          action: 'BLACKLIST',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (blacklistRequest) {
        throw new Error("Cannot mint to blacklisted address");
      }

      // Check if address is frozen
      const freezeRequest = await tx.freezeRequest.findFirst({
        where: {
          address,
          status: 'APPROVED',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (freezeRequest?.action === 'FREEZE') {
        throw new Error("Cannot mint to frozen address");
      }

      // Create mint request
      const mintRequest = await tx.mintRequest.create({
        data: {
          address,
          amount: BigInt(amount),
          requestedBy: session.user.id,
          customerId,
        },
      });

      // Create initial approval from requester
      await tx.actionApproval.create({
        data: {
          mintRequestId: mintRequest.id,
          approvedBy: session.user.id,
        },
      });

      return mintRequest;
    });

    return NextResponse.json({
      success: true,
      message: "Mint request created",
      requestId: result.id,
    });
  } catch (error) {
    console.error("Error creating mint request:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create mint request" },
      { status: 400 }
    );
  }
} 