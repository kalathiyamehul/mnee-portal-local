import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCSRF } from '@/lib/csrf';

export const GET = withCSRF(async function () {
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
}); 