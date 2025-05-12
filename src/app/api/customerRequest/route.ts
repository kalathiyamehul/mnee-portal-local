import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, address, action = "CREATE", customerId } = body;
    const config = await getConfig();

    // Validation checks...

    const customerRequest = await prisma.customerRequest.create({
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

    return NextResponse.json(customerRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating customer request:", error);
    return NextResponse.json(
      { error: "Failed to create customer request" },
      { status: 500 }
    );
  }
}