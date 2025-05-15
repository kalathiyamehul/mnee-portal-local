import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { logActivity } from "@/lib/activityLogger";

export async function POST(
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
          { email },
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
          email,
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
        name: "Customer Updated",
        action: "CUSTOMER_UPDATE",
        description: `Customer ${id} updated by user ${session.user.email}`,
        metadata: {
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
}