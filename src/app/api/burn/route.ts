import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";

export async function POST(request: Request) {
    console.log('Received burn request');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.text();
        console.log('Raw request body:', body);
        
        if (!body) {
            return NextResponse.json(
                { error: "Request body is empty" },
                { status: 400 }
            );
        }

        const payload = JSON.parse(body);
        console.log('Parsed payload:', payload);

        const { amount, outpoint } = payload;
        console.log('Extracted values:', { amount, outpoint });

        if (!amount || !outpoint) {
            return NextResponse.json(
                { error: "Amount and outpoint are required" },
                { status: 400 }
            );
        }

        // Create burn request
        const burnRequestData = {
            amount,
            requestedBy: session.user.id,
            outpoint,
            status: 'PENDING' as const,
        };
        console.log('Creating burn request with data:', burnRequestData);

        const burnRequest = await prisma.burnRequest.create({
            data: burnRequestData,
        });

        console.log('Created burn request:', burnRequest);
        
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
        
        if (error instanceof Error) {
            console.log('Full error:', {
                name: error.name,
                message: error.message,
                stack: error.stack,
            });
        }

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