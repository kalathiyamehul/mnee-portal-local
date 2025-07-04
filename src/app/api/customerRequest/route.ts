import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { emitCustomerUpdate } from "@/lib/sseEmitter";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const POST = withCSRF( async function(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, address, action = "CREATE", customerId } = body;
    const config = await getConfig();

    // Check if customer already exists (by email or address)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { name },
          { address },
        ],
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "A customer with this email or address already exists" },
        { status: 400 }
      );
    }

    // Validation checks...

    const customerRequest = await prisma.$transaction(async (tx) => {
      const req = await tx.customerRequest.create({
        data: {
          name,
          address,
          action,
          customerId,
          requestedBy: session.user.id,
          no_of_approvals: config?.minNoOfApproval || 2,
        }
      });

      await logActivity(tx, {
        action: ActivityAction.CUSTOMER_REQUEST_CREATE,
        metadata: {
          customerAddress: address,
          customerRequest: JSON.stringify(req, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      return req;
    });
    const customer: any = await prisma.customerRequest.findUnique({
      where: { id: customerRequest.id },
      include: {
        approvals: {
          include: {
            approver: true,
          },
        },
        customer: true,
        requester: true,
      },
    });
    if (customer?.amount) {
      customer.amount = Number(customer.amount);
    }
    emitCustomerUpdate({
      activityId: customerRequest.id,
      approval: customer,
      type: "CREATE",
    });
    return NextResponse.json(customerRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating customer request:", error);
    return NextResponse.json(
      { error: "Failed to create customer request" },
      { status: 500 }
    );
  }
}, createAPIRateLimit());