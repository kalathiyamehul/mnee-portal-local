import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ hasUsers: count > 0 });
  } catch (error) {
    console.error("Error checking users:", error);
    return NextResponse.json(
      { error: "Failed to check users" },
      { status: 500 }
    );
  }
} 