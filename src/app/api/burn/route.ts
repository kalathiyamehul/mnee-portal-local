import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/authOptions";
import type { MNEEUtxo } from "@/types";
import { performSystemChecks, SystemOperation } from "@/lib/systemStatus";
import { fetchMneeUtxos } from "@/utils/api";

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

        // Check if system is paused
        const systemCheck = await performSystemChecks(prisma, {
            operation: SystemOperation.BURN_REQUEST_CREATE
        });
        if (!systemCheck.isValid) {
            return NextResponse.json(
                { error: systemCheck.error },
                { status: 400 }
            );
        }

        // Get burn address from config
        const config = await prisma.config.findFirst({
            where: { id: 1 }
        });

        if (!config?.burnAddress) {
            return NextResponse.json(
                { error: "Burn address not configured" },
                { status: 400 }
            );
        }

        const [txid, voutStr] = outpoint.split('_');
        const vout = Number.parseInt(voutStr, 10);

        if (!txid || Number.isNaN(vout)) {
            return NextResponse.json(
                { error: "Invalid outpoint format" },
                { status: 400 }
            );
        }

        const utxos = await fetchMneeUtxos([config.burnAddress]);
        const targetUtxo = utxos.find((u: MNEEUtxo) => u.txid === txid && u.vout === vout);

        if (!targetUtxo) {
            return NextResponse.json(
                { error: "UTXO not found or not owned by burn address" },
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

        // Create burn request
        const burnRequestData = {
            amount,
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
                { error: "Invalid request body" },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create burn request" },
            { status: 500 }
        );
    }
} 