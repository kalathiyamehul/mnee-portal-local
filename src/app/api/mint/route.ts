import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { isSystemPaused } from '@/lib/systemStatus';
import { toTokenSat } from 'satoshi-token';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { amount, customerId } = await request.json();

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if system is paused
      const isPaused = await isSystemPaused(tx);
      if (isPaused) {
        throw new Error("System is paused. Cannot create mint requests at this time.");
      }

      // Get config for decimals
      const config = await tx.config.findFirst({
        where: { id: 1 }
      });

      if (!config) {
        throw new Error("System configuration not found");
      }

      // Convert display amount to satoshis
      const amountInSats = toTokenSat(amount, config.decimals, "bigint");

      // Look up customer and their address
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      const { address } = customer;

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

      // Create mint request with satoshi amount
      const mintRequest = await tx.mintRequest.create({
        data: {
          address,
          amount: amountInSats,
          requestedBy: session.user.id,
          customerId,
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