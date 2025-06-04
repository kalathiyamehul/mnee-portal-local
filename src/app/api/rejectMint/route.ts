import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { emitMintUpdate } from "@/lib/sseEmitter";

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let mintRequestId: string | undefined;
  let reason: string | undefined;

  try {
    const body = await request.json();
    mintRequestId = body.mintRequestId;
    reason = body.reason;

    if (!mintRequestId) {
      return NextResponse.json({ error: "Missing mintRequestId" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch the mint request
      const mintRequest = await tx.mintRequest.findUnique({
        where: { id: mintRequestId },
        include: {
          requester: true,
          approvals: true,
        },
      });

      if (!mintRequest) {
        throw new Error("Mint request not found");
      }

      if (mintRequest.status !== "PENDING") {
        throw new Error("Only pending requests can be rejected");
      }

      // Prevent self-rejection
      if (mintRequest.requestedBy === session.user.id) {
        throw new Error("You cannot reject your own request");
      }

      // System checks (if system is paused)
      const systemCheck = await performSystemChecks(tx, {
        address: mintRequest.address,
        operation: SystemOperation.MINT_REQUEST_REJECT,
      });
      if (!systemCheck.isValid) {
        throw new Error(systemCheck.error);
      }

      const updated = await tx.mintRequest.update({
        where: { id: mintRequestId },
        data: {
          status: "REJECTED",
          updatedAt: new Date(),
        },
      });

      await logActivity(tx, {
        name: "Mint Request Rejected",
        action: "MINT_REQUEST_REJECT",
        description: `Mint request ${mintRequestId} rejected by user ${session.user.id}`,
        metadata: {
          mintRequest: JSON.stringify(updated, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
          reason,
        },
      });

      return { status: "REJECTED" };
    });
    emitMintUpdate({
      activityId: mintRequestId,
      approval: undefined,
      type: "REJECT",
    });
    return NextResponse.json({
      success: true,
      message: "Mint request rejected",
      status: result.status,
    });
  } catch (error) {
    console.error("Error rejecting mint request:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to reject mint request" },
      { status: 400 }
    );
  }
}, createAPIRateLimit())