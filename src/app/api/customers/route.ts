import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { withCSRF } from "@/lib/csrf";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get pagination parameters from URL
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '6');

    // If page and limit are -1, return all records
    const shouldReturnAll = page === -1 && limit === -1;

    // Get total count and paginated customers
    const [totalCount, customers] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.findMany({
        skip: shouldReturnAll ? 0 : (page - 1) * limit,
        take: shouldReturnAll ? undefined : limit,
        orderBy: { createdAt: "desc" },
        include: {
          creator: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      })
    ]);

    return NextResponse.json({
      customers,
      pagination: {
        total: totalCount,
        page: shouldReturnAll ? 1 : page,
        limit: shouldReturnAll ? totalCount : limit,
        totalPages: shouldReturnAll ? 1 : Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export const POST = withCSRF(async function(request: Request) {
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

    // Check if email or address already exists
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

    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        address,
        createdBy: session.user.id,
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

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
})