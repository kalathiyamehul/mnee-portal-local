// src/app/api/config/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.config.findFirst();
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
  const { tokenId, feeAddress, fees, decimals } = await request.json();

  // Optionally validate the data here

  const config = await prisma.config.upsert({
    where: { id: 1 },
    update: { tokenId, feeAddress, fees, decimals },
    create: { id: 1, tokenId, feeAddress, fees, decimals },
  });

  return NextResponse.json(config);
}

export async function DELETE() {
  try {
    await prisma.config.deleteMany(); // Deletes all Config records
    return NextResponse.json({ message: "Configuration cleared successfully." });
  } catch (error) {
    console.error("Error deleting config:", error);
    return NextResponse.json(
      { error: "Error clearing configuration." },
      { status: 500 }
    );
  }
}