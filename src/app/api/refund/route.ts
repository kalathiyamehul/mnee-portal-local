import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { fetchTxo } from "@/utils/api";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitrefundUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const POST = withCSRF(async function (request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { outpoint, refundAddress, no_of_approvals, amount } = await request.json();

    if (!outpoint) {
      return NextResponse.json(
        { error: "Missing required field: outpoint" },
        { status: 400 }
      );
    }

    if (!refundAddress) {
      return NextResponse.json(
        { error: "Missing required field: refundAddress" },
        { status: 400 }
      );
    }

    // System checks (ensuring not blacklisted, not paused, etc.)
    const systemCheck = await performSystemChecks(prisma, {
      operation: SystemOperation.REFUND_REQUEST_CREATE,
      address: refundAddress,
    });
    if (!systemCheck.isValid) {
      return NextResponse.json({ error: systemCheck.error }, { status: 400 });
    }

    // Check for existing PENDING request for this outpoint
    const existing = await prisma.refundRequest.findFirst({
      where: { outpoint, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A refund request is already pending for this burn" },
        { status: 400 }
      );
    }

    // Get the amount from the UTXO
    // const txo = await fetchTxo(outpoint);
    // const amount = BigInt(txo.data.bsv21.amt);

    // Create the RefundRequest (status=PENDING)
    const refundRequest = await prisma.refundRequest.create({
      data: {
        outpoint,
        refundAddress,
        amount,
        requestedBy: session.user.id,
        status: "PENDING",
        no_of_approvals: no_of_approvals ?? 2, // Use provided or default
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await logActivity(prisma, {
      action: ActivityAction.REFUND_REQUEST_CREATE,
      metadata: {
        refundAddress,
        outpoint,
        refundRequest: JSON.stringify(refundRequest, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ),
        originalOwners: JSON.stringify({}),
        securityCheckPassed: true,
      },
    });

    // Get the RefundRequest
    const refund: any = await prisma.refundRequest.findUnique({
      where: { id: refundRequest.id },
      include: {
        approvals: {
          include: {
            approver: true,
          },
        },
        requester: true,
      },
    });

    if (refund?.amount) {
      refund.amount = Number(refund.amount);
    }

    // Emit the refund request update
    emitrefundUpdate({
      refundRequest: refund,
      type: "CREATE",
    });

    return NextResponse.json({
      success: true,
      message: "Refund request created successfully",
      requestId: refundRequest.id,
    });
  } catch (error) {
    console.error("Error creating refund request:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create refund request",
      },
      { status: 500 }
    );
  }
}, createAPIRateLimit())