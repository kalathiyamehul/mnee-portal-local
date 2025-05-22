import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";

export const POST = withCSRF( async function(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, address, action = "CREATE", customerId } = body;
    const config = await getConfig();

    // Check if customer already exists (by email or address)
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
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
          email,
          address,
          action,
          customerId,
          requestedBy: session.user.id,
          no_of_approvals: config?.minNoOfApproval || 2,
        }
      });

      await logActivity(tx, {
        name: "Customer Request Created",
        action: "CUSTOMER_REQUEST_CREATE",
        description: `Customer request created for ${email}`,
        metadata: {
          customerRequest: JSON.stringify(req, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      return req;
    });

    return NextResponse.json(customerRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating customer request:", error);
    return NextResponse.json(
      { error: "Failed to create customer request" },
      { status: 500 }
    );
  }
});