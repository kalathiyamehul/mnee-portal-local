// src/app/api/config/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BURN_WIF, MINT_WIF } from "@/env";
import { PrivateKey } from "@bsv/sdk";
import { getConfig, revalidateConfig } from "@/lib/config";

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
  const { tokenId, feeAddress, fees, decimals, latestMinterTx } = await request.json();

  const mintAddress = PrivateKey.fromWif(MINT_WIF).toAddress();
  const burnAddress = PrivateKey.fromWif(BURN_WIF).toAddress();
  try {
    const config = await prisma.config.upsert({
      where: { id: 1 },
      update: { tokenId, feeAddress, fees, decimals, latestMinterTx, mintAddress, burnAddress },
      create: { id: 1, tokenId, feeAddress, fees, decimals, latestMinterTx, fundAddress: "", mintAddress, burnAddress },
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