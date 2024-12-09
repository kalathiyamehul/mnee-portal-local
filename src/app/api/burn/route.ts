import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import { getConfig } from "@/lib/config";
import { toTokenSat } from "satoshi-token";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { amount } = await request.json();

        if (!amount) {
            return NextResponse.json(
                { error: "Amount is required" },
                { status: 400 }
            );
        }

        // Get config for decimals
        const config = await getConfig();
        if (!config) {
            return NextResponse.json(
                { error: "Token configuration not found" },
                { status: 400 }
            );
        }

        // Create burn request
        const burnRequest = await prisma.burnRequest.create({
            data: {
                amount: toTokenSat(amount, config.decimals),
                requestedBy: session.user.id,
            },
        });

        return NextResponse.json({ success: true, burnRequest });
    } catch (error) {
        console.error("Error creating burn request:", error);
        return NextResponse.json(
            { error: "Failed to create burn request" },
            { status: 500 }
        );
    }
} 