import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { isSystemPaused } from '@/lib/systemStatus';
import { toTokenSat } from 'satoshi-token';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { amount, address, customerId } = await request.json();

    if (!amount || !address) {
      return NextResponse.json(
        { error: "Amount and address are required" },
        { status: 400 }
      );
    }

    // Check if system is paused
    const isPaused = await isSystemPaused(prisma);
    if (isPaused) {
      return NextResponse.json(
        { error: "System is paused. Cannot create mint requests at this time." },
        { status: 400 }
      );
    }

    // Get config for decimals
    const config = await prisma.config.findFirst({
      where: { id: 1 }
    });

    if (!config?.decimals) {
      return NextResponse.json(
        { error: "Token decimals not configured" },
        { status: 400 }
      );
    }

    // Convert amount to token-sat
    const amountSat = toTokenSat(amount, config.decimals);

    // Check for existing pending request for this address
    const existingRequest = await prisma.mintRequest.findFirst({
      where: {
        address,
        status: 'PENDING',
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "A pending mint request already exists for this address" },
        { status: 400 }
      );
    }

    // Create mint request
    const result = await prisma.$transaction(async (tx) => {
      const mintRequest = await tx.mintRequest.create({
        data: {
          amount: amountSat,
          address,
          status: 'PENDING',
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