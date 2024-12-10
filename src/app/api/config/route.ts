// src/app/api/config/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FUND_ADDRESS, MINT_WIF } from "@/env";
import { PrivateKey } from "@bsv/sdk";

export async function GET() {
  try {
    const config = await prisma.config.findFirst();
    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
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
  try {
    const config = await prisma.config.upsert({
      where: { id: 1 },
      update: { tokenId, feeAddress, fees, decimals, latestMinterTx, fundAddress: FUND_ADDRESS, mintAddress },
      create: { id: 1, tokenId, feeAddress, fees, decimals, latestMinterTx, fundAddress: FUND_ADDRESS, mintAddress },
    });
    return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
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