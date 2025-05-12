import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { customerRequestId } = await request.json();
    
    const customerRequest = await prisma.customerRequest.update({
      where: { id: customerRequestId },
      include: { approvals: true },
      data: {
        approvals: {
          create: {
            approvedBy: session.user.id
          }
        }
      }
    });

    // Update subsequent references from params.id to customerRequestId
    if (customerRequest.approvals.length >= customerRequest.no_of_approvals) {
      await prisma.customerRequest.update({
        where: { id: customerRequestId },
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