import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { fetchTxo } from "@/utils/api";
import { logActivity } from "@/lib/activityLogger";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { outpoint, refundAddress, no_of_approvals } = await request.json();

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
    const txo = await fetchTxo(outpoint);
    const amount = BigInt(txo.data.bsv21.amt);

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
      name: "Refund Request Created",
      action: "REFUND_REQUEST_CREATE",
      description: `Refund request created for outpoint ${outpoint} by user ${session.user.id}`,
      metadata: {
        refundRequest: JSON.stringify(refundRequest, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        ),
      },
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
}