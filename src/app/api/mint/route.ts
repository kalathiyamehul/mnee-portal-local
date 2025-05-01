import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/authOptions';
import { performSystemChecks, SystemOperation } from '@/lib/systemStatus';
import { toTokenSat } from 'satoshi-token';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { amount, customerId, no_of_approvals } = await request.json();

    if (!amount || !customerId) {
      return NextResponse.json(
        { error: "Amount and customer ID are required" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Validate no_of_approvals
    const noOfApprovals = parseInt(no_of_approvals);
    if (isNaN(noOfApprovals) || noOfApprovals < 0) {
      return NextResponse.json(
        { error: "No of Approvals must be a non-negative integer" },
        { status: 400 }
      );
    }

    // Get customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 400 }
      );
    }

    // Check if system is paused and address is not blacklisted
    const systemCheck = await performSystemChecks(prisma, {
      address: customer.address,
      operation: SystemOperation.MINT_REQUEST_CREATE
    });
    if (!systemCheck.isValid) {
      return NextResponse.json(
        { error: systemCheck.error },
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

    // Check for existing pending request for this customer
    const existingRequest = await prisma.mintRequest.findFirst({
      where: {
        customerId,
        status: 'PENDING',
      }
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "A pending mint request already exists for this customer" },
        { status: 400 }
      );
    }

    // Create mint request
    const result = await prisma.$transaction(async (tx) => {
      const mintRequest = await tx.mintRequest.create({
        data: {
          amount: amountSat,
          address: customer.address,
          status: 'PENDING',
          requestedBy: session.user.id,
          customerId,
          no_of_approvals: noOfApprovals,
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