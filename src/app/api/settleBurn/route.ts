import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { logActivity } from "@/lib/activityLogger"; // <-- Add this import

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let burnRequestId: string | undefined;

  try {
    const body = await request.json();
    burnRequestId = body.burnRequestId;

    if (!burnRequestId) {
      return NextResponse.json({ error: "Missing burnRequestId" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const burnRequest = await tx.burnRequest.findUnique({
        where: { id: burnRequestId },
        include: {
          requester: true,
          approvals: true,
        },
      });

      if (!burnRequest) {
        throw new Error("Burn request not found");
      }

      if (burnRequest.status !== "APPROVED") {
        throw new Error("Only Approved Burn requests can be Settled");
      }

      if (burnRequest.requestedBy === session.user.id) {
        throw new Error("You cannot Settle your own request");
      }

      const systemCheck = await performSystemChecks(tx, {
        address: burnRequest.refundAddress ?? undefined,
        operation: SystemOperation.SETTLED_AFTER_BURN,
      });
      if (!systemCheck.isValid) {
        throw new Error(systemCheck.error);
      }

      await tx.burnRequest.update({
        where: { id: burnRequestId },
        data: {
          status: "SETTLED",
          updatedAt: new Date(),
        },
      });

      await logActivity(tx, {
        name: "Burn Request Settled",
        action: "BURN_REQUEST_SETTLE",
        description: `Burn request ${burnRequestId} settled by user ${session.user.id}`,
        metadata: {
          burnRequest: JSON.stringify(burnRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      return { status: "SETTLED" };
    });

    return NextResponse.json({
      success: true,
      message: "Burn request SETTLED",
      status: result.status,
    });
  } catch (error) {
    console.error("Error Settling Approved burn request:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to Settle Approved burn request" },
      { status: 400 }
    );
  }
}