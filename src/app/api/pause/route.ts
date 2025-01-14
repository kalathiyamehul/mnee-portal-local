// src/app/api/pause/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { action } = await request.json();

	// Validate action
	if (!["PAUSE", "RESUME"].includes(action)) {
		return NextResponse.json({ error: "Invalid action" }, { status: 400 });
	}

	// Check for existing pending request
	const existingRequest = await prisma.actionRequest.findFirst({
		where: {
			action,
			status: "PENDING",
		},
	});

	if (existingRequest) {
		return NextResponse.json(
			{ error: "An action request is already pending" },
			{ status: 400 },
		);
	}

	// Create the action request (requires separate approval from requester)
	const result = await prisma.actionRequest.create({
		data: {
			action,
			requestedBy: session.user.id,
		},
	});

	return NextResponse.json({ actionRequest: result }, { status: 201 });
}
