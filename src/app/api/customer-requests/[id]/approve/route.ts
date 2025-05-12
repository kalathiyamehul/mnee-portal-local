import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customerRequest = await prisma.customerRequest.update({
      where: { id: params.id },
      include: { approvals: true },
      data: {
        approvals: {
          create: {
            approvedBy: session.user.id
          }
        }
      }
    });

    if (customerRequest.approvals.length >= customerRequest.no_of_approvals) {
      // Create/update actual customer
      const customerData = {
        name: customerRequest.name,
        email: customerRequest.email,
        address: customerRequest.address,
        createdBy: customerRequest.requestedBy
      };

      const customer = customerRequest.action === "CREATE" 
        ? await prisma.customer.create({ data: customerData })
        : await prisma.customer.update({
            where: { id: customerRequest.customerId! },
            data: customerData
          });

      await prisma.customerRequest.update({
        where: { id: params.id },
        data: { status: "APPROVED" }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}