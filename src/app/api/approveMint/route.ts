import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { isSystemPaused } from "@/lib/systemStatus";

export async function POST(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { mintRequestId } = await request.json();

	try {
		const result = await prisma.$transaction(async (tx) => {
			// Verify the approving user exists
			const approvingUser = await tx.user.findUnique({
				where: { id: session.user.id },
			});

			if (!approvingUser) {
				throw new Error("Approving user not found");
			}

			// Fetch the mint request
			const mintRequest = await tx.mintRequest.findUnique({
				where: { id: mintRequestId },
				include: {
					requester: true,
					approvals: true,
				},
			});

			if (!mintRequest) {
				throw new Error("Mint request not found");
			}

			if (mintRequest.status !== "PENDING") {
				throw new Error("Request is not pending");
			}

			// Check if system is paused
			const isPaused = await isSystemPaused(tx);
			if (isPaused) {
				throw new Error("System is paused. Cannot approve mint requests at this time.");
			}

			// Check if user has already approved
			const hasApproved = mintRequest.approvals.some(
				(approval) => approval.approvedBy === session.user.id
			);

			if (hasApproved) {
				throw new Error("You have already approved this request");
			}

			// Create approval
			await tx.actionApproval.create({
				data: {
					mintRequestId,
					approvedBy: session.user.id,
				},
			});

			// Check if we have enough approvals
			const approvalsCount = await tx.actionApproval.count({
				where: { mintRequestId },
			});

			if (approvalsCount >= 2) {
				// Update request status to APPROVED
				await tx.mintRequest.update({
					where: { id: mintRequestId },
					data: { status: "APPROVED" },
				});

				return { status: "APPROVED", approvalsCount };
			}

			return { status: "PENDING", approvalsCount };
		});

		return NextResponse.json({
			success: true,
			message: result.status === "APPROVED" ? "Request approved" : "Approval recorded",
			status: result.status,
			approvalsCount: result.approvalsCount,
		});
	} catch (error) {
		console.error("Error approving mint request:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to approve mint request" },
			{ status: 400 }
		);
	}
}
