// src/app/api/approveFreeze/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { isSystemPaused } from "@/lib/systemStatus";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from "@/lib/csrf";

export const POST = withCSRF(async function(request: Request) {
	const session = await getServerSession(authOptions);
	console.log('Session:', { userId: session?.user?.id });

	if (!session?.user?.id) {
		// console.log('Unauthorized: No session or user ID');
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	// console.log('Request body:', body);
	const { freezeRequestId } = body;

	if (!freezeRequestId) {
		// console.log('Missing freezeRequestId in request body');
		return NextResponse.json({ error: "Missing freezeRequestId" }, { status: 400 });
	}

	// Use a transaction to ensure data consistency
	try {
		const result = await prisma.$transaction(async (tx) => {
			// Get the freeze request
			// console.log('Finding freeze request:', { freezeRequestId });
			const freezeRequest = await tx.freezeRequest.findUnique({
				where: { id: freezeRequestId },
				include: {
					approvals: true,
					requester: {
						select: {
							id: true,
							email: true,
						},
					},
				},
			});

			// console.log('Found freeze request:', freezeRequest);

			if (!freezeRequest) {
				// console.log('Freeze request not found');
				throw new Error("Freeze request not found");
			}

			if (freezeRequest.status !== 'PENDING') {
				// console.log('Invalid status:', { status: freezeRequest.status });
				throw new Error("This request is no longer pending");
			}

			// Check if system is paused
			const isPaused = await isSystemPaused(tx);
			if (isPaused) {
				throw new Error("System is paused. Cannot approve freeze requests at this time.");
			}

			if (freezeRequest.requester.id === session.user.id) {
				console.log('Self-approval attempt:', { 
					requesterId: freezeRequest.requester.id, 
					approverId: session.user.id 
				});
				throw new Error("You cannot approve your own request");
			}

			// Check if user has already approved
			const hasApproved = freezeRequest.approvals.some(
				(approval) => approval.approvedBy === session.user.id
			);

			console.log('Approval check:', { 
				hasApproved,
				approvals: freezeRequest.approvals,
				currentUserId: session.user.id
			});

			if (hasApproved) {
				// console.log('Already approved by user');
				throw new Error("You have already approved this request");
			}

			// Create the approval
			console.log('Creating approval:', { 
				freezeRequestId,
				approvedBy: session.user.id 
			});
			const approval = await tx.freezeApproval.create({
				data: {
					freezeRequestId,
					approvedBy: session.user.id,
				},
				include: {
					approver: {
						select: {
							name: true,
							email: true,
						},
					},
				},
			});

			await logActivity(tx, {
				name: "Freeze Request Approved",
				action: "FREEZE_REQUEST_APPROVE",
				description: `Freeze request ${freezeRequestId} approved by user ${session.user.email}`,
				metadata: {
					freezeRequest: JSON.stringify(freezeRequest, (key, value) =>
						typeof value === 'bigint' ? value.toString() : value
					),
					approval: JSON.stringify(approval, (key, value) =>
						typeof value === 'bigint' ? value.toString() : value
					),
				},
			});

			// Check if we have enough approvals
			const updatedApprovals = await tx.freezeApproval.count({
				where: { freezeRequestId },
			});

			// console.log('Total approvals:', updatedApprovals);

			// If we have 2 approvals, mark as approved
			if (updatedApprovals === freezeRequest.no_of_approvals) {
				// console.log('Updating request to APPROVED');
				const updatedRequest = await tx.freezeRequest.update({
					where: { id: freezeRequestId },
					data: { status: 'APPROVED' },
					include: {
						requester: {
							select: {
								name: true,
								email: true,
							},
						},
						approvals: {
							include: {
								approver: {
									select: {
										name: true,
										email: true,
									},
								},
							},
						},
					},
				});

				await logActivity(tx, {
					name: "Freeze Request Fully Approved",
					action: "FREEZE_REQUEST_FULLY_APPROVED",
					description: `Freeze request ${freezeRequestId} fully approved after reaching required approvals`,
					metadata: {
						freezeRequestId: freezeRequestId,
						approvals: updatedApprovals,
					},
				});

				return updatedRequest;
			}

			return freezeRequest;
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error('Error in freeze approval:', error);
		const errorMessage = error instanceof Error ? error.message : "Failed to approve freeze request";
		// console.log('Returning error:', errorMessage);
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 }
		);
	}
})
