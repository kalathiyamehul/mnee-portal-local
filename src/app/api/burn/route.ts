import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.text();
        
        if (!body) {
            return NextResponse.json(
                { error: "Request body is empty" },
                { status: 400 }
            );
        }

        const payload = JSON.parse(body);
        const { amount, outpoint } = payload;

        if (!amount || !outpoint) {
            return NextResponse.json(
                { error: "Amount and outpoint are required" },
                { status: 400 }
            );
        }

        // Check for existing burn requests for this outpoint
        const existingRequest = await prisma.burnRequest.findFirst({
            where: {
                outpoint,
                status: { in: ['PENDING', 'APPROVED'] }
            }
        });

        if (existingRequest) {
            return NextResponse.json(
                { error: "A burn request for this outpoint already exists" },
                { status: 400 }
            );
        }

        // Check if system is paused
        const pauseRequest = await prisma.actionRequest.findFirst({
            where: {
                action: 'PAUSE',
                status: 'APPROVED',
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const resumeRequest = await prisma.actionRequest.findFirst({
            where: {
                action: 'RESUME',
                status: 'APPROVED',
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // System is paused if the latest approved PAUSE is more recent than the latest approved RESUME
        const isPaused = pauseRequest && (!resumeRequest || pauseRequest.createdAt > resumeRequest.createdAt);

        if (isPaused) {
            return NextResponse.json(
                { error: "System is paused. Cannot create burn requests at this time." },
                { status: 400 }
            );
        }

        // Create burn request
        const burnRequestData = {
            amount: BigInt(amount),
            requestedBy: session.user.id,
            outpoint,
            status: 'PENDING' as const,
        };

        const burnRequest = await prisma.burnRequest.create({
            data: burnRequestData,
        });
        
        // Convert BigInt to string for JSON serialization
        const response = {
            success: true,
            burnRequest: {
                ...burnRequest,
                amount: burnRequest.amount.toString(),
            }
        };
        
        return NextResponse.json(response);
    } catch (error) {
        console.error("Error creating burn request:", error);

        if (error instanceof SyntaxError) {
            return NextResponse.json(
                { error: "Invalid JSON payload" },
                { status: 400 }
            );
        }

        const errorMessage = error instanceof Error ? error.message : 'Failed to create burn request';
        return NextResponse.json(
            { 
                error: errorMessage,
                success: false 
            },
            { status: 500 }
        );
    }
} 