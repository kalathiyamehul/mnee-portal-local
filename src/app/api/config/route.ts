// src/app/api/config/route.ts
import { NextResponse } from "next/server";
import { getConfig, revalidateConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";

// Enable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: "Failed to fetch config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const config = await prisma.config.update({
      where: { id: 1 },
      data
    });

    // Revalidate cache after update
    await revalidateConfig();

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error updating config:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
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