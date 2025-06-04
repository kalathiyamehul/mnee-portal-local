import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitCustomerUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const POST = withCSRF(async function(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { customerRequestId } = await request.json();
    const customerRequest = await prisma.customerRequest.findUnique({
      where: { id: customerRequestId },
      include: { approvals: true, requester: true },
    });
    if (!customerRequest) {
      return NextResponse.json({ error: "Customer request not found" }, { status: 404 });
    }
    if (customerRequest.status !== "PENDING") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
    }
    if (customerRequest.requestedBy === session.user.id) {
      return NextResponse.json({ error: "Cannot approve your own request" }, { status: 400 });
    }
    const existingApproval = await prisma.customerApproval.findFirst({
      where: {
        customerRequestId,
        approvedBy: session.user.id,
      },
    });
    if (existingApproval) {
      return NextResponse.json({ error: "You have already approved this request" }, { status: 400 });
    }

    
    // Transaction for approval and possible customer creation
    const approval = await prisma.$transaction(async (tx) => {
      const approval = await tx.customerApproval.create({
        data: {
          customerRequestId,
          approvedBy: session.user.id,
        },
      });
      await logActivity(tx, {
        name: "Customer Request Approved",
        action: "CUSTOMER_REQUEST_APPROVE",
        description: `Customer request ${customerRequestId} approved by user ${session.user.email}`,
        metadata: {
          customerRequestId,
          approverId: session.user.id,
        },
      });
      // Check if enough approvals
      const approvalsCount = await tx.customerApproval.count({
        where: { customerRequestId },
      });
      if (approvalsCount >= customerRequest.no_of_approvals) {
        await tx.customerRequest.update({
          where: { id: customerRequestId },
          data: { status: "APPROVED" },
        });
        await logActivity(tx, {
          name: "Customer Request Fully Approved",
          action: "CUSTOMER_REQUEST_FULLY_APPROVED",
          description: `Customer request ${customerRequestId} fully approved after reaching required approvals`,
          metadata: {
            customerRequestId,
            approvalsCount,
          },
        });
        if (customerRequest.action === "CREATE") {
          const createdCustomer = await tx.customer.create({
            data: {
              name: customerRequest.name,
              email: customerRequest.email,
              address: customerRequest.address,
              createdBy: customerRequest.requestedBy,
            },
          });
          await logActivity(tx, {
            name: "Customer Created Successfully!",
            action: "CUSTOMER_CREATE",
            description: `Customer created from approved request ${customerRequestId}`,
            metadata: {
              customer: JSON.stringify(createdCustomer, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
              ),
            },
          });
          emitCustomerUpdate({
            activityId: customerRequestId,
            type: "APPROVED",
          })
        }
      }
      return approval;
    });

    // Emit the approval update
    const approvalWithUser = await prisma.customerApproval.findUnique({
      where: {
        id: approval.id,
      },
      include: {
        approver: true,
      },
    });
    emitCustomerUpdate({
      activityId: customerRequestId,
      approval: approvalWithUser,
      type: "APPROVE",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}, createAPIRateLimit());