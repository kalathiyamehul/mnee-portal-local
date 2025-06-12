import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitburnUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let burnRequestId: string | undefined;
  let reason: string | undefined;

  try {
    const body = await request.json();
    burnRequestId = body.burnRequestId;
    reason = body.reason;

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

      if (burnRequest.status !== "PENDING") {
        throw new Error("Only pending requests can be rejected");
      }

      if (burnRequest.requestedBy === session.user.id) {
        throw new Error("You cannot reject your own request");
      }

      const systemCheck = await performSystemChecks(tx, {
        address: burnRequest.refundAddress ?? undefined,
        operation: SystemOperation.BURN_REQUEST_REJECT,
      });
      if (!systemCheck.isValid) {
        throw new Error(systemCheck.error);
      }

      const updated = await tx.burnRequest.update({
        where: { id: burnRequestId },
        data: {
          status: "REJECTED",
          updatedAt: new Date(),
        },
      });

      await logActivity(tx, {
        action: ActivityAction.BURN_REQUEST_REJECT,
        metadata: {
          burnRequestId,
          burnRequest: JSON.stringify(updated, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          )
        },
      });

      return { status: "REJECTED" };
    });
    emitburnUpdate({
      activityId: burnRequestId,
      approval: undefined,
      type: "REJECT",
    });
    return NextResponse.json({
      success: true,
      message: "Burn request rejected",
      status: result.status,
    });
  } catch (error) {
    console.error("Error rejecting burn request:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reject burn request" },
      { status: 400 }
    );
  }
}, createAPIRateLimit())