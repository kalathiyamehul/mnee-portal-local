import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { logActivity } from "@/lib/activityLogger";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { customerRequestId } = await request.json();
    
    const customerRequest = await prisma.$transaction(async (tx) => {
      // Update with approval
      const updatedRequest = await tx.customerRequest.update({
        where: { id: customerRequestId },
        include: { 
          approvals: true,
          requester: true
        },
        data: {
          approvals: {
            create: {
              approvedBy: session.user.id
            }
          }
        }
      });

      await logActivity(tx, {
        name: "Customer Request Approved",
        action: "CUSTOMER_REQUEST_APPROVE",
        description: `Customer request ${customerRequestId} approved by user ${session.user.email}`,
        metadata: {
          customerRequest: JSON.stringify(updatedRequest, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ),
        },
      });

      // Create customer when approvals met
      if (updatedRequest.approvals.length >= updatedRequest.no_of_approvals) {
        await tx.customerRequest.update({
          where: { id: customerRequestId },
          data: { status: "APPROVED" }
        });

        // Only create for new customer requests
        if (updatedRequest.action === "CREATE") {
          const createdCustomer = await tx.customer.create({
            data: {
              name: updatedRequest.name,
              email: updatedRequest.email,
              address: updatedRequest.address,
              createdBy: updatedRequest.requestedBy
            }
          });

          await logActivity(tx, {
            name: "Customer Created",
            action: "CUSTOMER_CREATE",
            description: `Customer created from approved request ${customerRequestId}`,
            metadata: {
              customer: JSON.stringify(createdCustomer, (key, value) =>
                typeof value === 'bigint' ? value.toString() : value
              ),
            },
          });
        }
      }

      return updatedRequest;
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Approval error:", error);
    return NextResponse.json(
      { error: "Failed to process approval" },
      { status: 500 }
    );
  }
}