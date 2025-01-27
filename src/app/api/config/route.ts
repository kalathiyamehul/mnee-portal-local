// src/app/api/config/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBurnWif, getMintWif } from "@/env";
import { PrivateKey } from "@bsv/sdk";
import { getConfig, revalidateConfig } from "@/lib/config";
import { Prisma } from "@prisma/client";

// Enable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    const config = await getConfig();
    if (!config) {
      return NextResponse.json(
        { error: "No configuration found" },
        { status: 404 }
      );
    }
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: "Error fetching configuration." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { tokenId, feeAddress, decimals, latestMinterTx } = await request.json();

  const mintAddress = PrivateKey.fromWif(await getMintWif()).toAddress();
  const burnAddress = PrivateKey.fromWif(await getBurnWif()).toAddress();
  try {
    // Get current config to keep existing fees
    const currentConfig = await prisma.config.findUnique({
      where: { id: 1 }
    });

    const defaultFees = [
      { min: 0, max: 10000, fee: 50 },
      { min: 10001, max: Number.MAX_SAFE_INTEGER, fee: 1000 }
    ];

    const config = await prisma.config.upsert({
      where: { id: 1 },
      update: { 
        tokenId, 
        feeAddress, 
        decimals, 
        latestMinterTx, 
        mintAddress, 
        burnAddress,
        // Keep existing fees or use default
        fees: currentConfig?.fees ?? defaultFees
      },
      create: { 
        id: 1, 
        tokenId, 
        feeAddress, 
        decimals, 
        latestMinterTx, 
        fundAddress: "", 
        mintAddress, 
        burnAddress,
        // Use default fees for new config
        fees: defaultFees
      },
    });

    // Revalidate cache after update
    await revalidateConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error saving config:", error);
    return NextResponse.json(
      { error: "Error saving configuration." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await prisma.config.deleteMany();
    return NextResponse.json(
      { message: "Configuration cleared." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error clearing config:", error);
    return NextResponse.json(
      { error: "Error clearing configuration." },
      { status: 500 }
    );
  }
}