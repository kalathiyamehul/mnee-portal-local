import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const POST = withCSRF(async function (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = (await params).id;
    const body = await request.json();
    const { name, email, address } = body;

    if (!name || !email || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email or address already exists for a different customer
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { name },
          { address },
        ],
        NOT: {
          id,
        },
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "A customer with this email or address already exists" },
        { status: 400 }
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          name,
          address,
        },
        include: {
          creator: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      await logActivity(tx, {
        action: ActivityAction.CUSTOMER_UPDATE,
        metadata: {
          customerId: id,
          customer: JSON.stringify(updated, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      return updated;
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}, createAPIRateLimit())

export const PATCH = withCSRF(async function (
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = (await params).id;
    const body = await request.json();
    const { status } = body;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          isActive: !customer.isActive,
        },
      });

      await logActivity(tx, {
        action: ActivityAction.CUSTOMER_UPDATE,
        metadata: {
          customerId: id,
          isActive: updated.isActive,
        },
      });

      return updated;
    });

    return NextResponse.json(updatedCustomer);
  } catch (error) {
    console.error("Error toggling customer active state:", error);
    return NextResponse.json(
      { error: "Failed to toggle customer active state" },
      { status: 500 }
    );
  }
}, createAPIRateLimit());