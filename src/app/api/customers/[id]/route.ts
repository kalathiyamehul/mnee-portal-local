import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, address } = body;

    if (!name || !email || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if email or address already exists for other customers
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          { address },
        ],
        NOT: {
          id: params.id
        }
      },
    });

    if (existingCustomer) {
      return NextResponse.json(
        { error: "A customer with this email or address already exists" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        name,
        email,
        address,
      },
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