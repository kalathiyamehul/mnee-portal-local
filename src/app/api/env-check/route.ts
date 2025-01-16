import { NextResponse } from "next/server";
import { MINT_WIF, BURN_WIF } from "@/env";

export async function HEAD() {
  if (!MINT_WIF || !BURN_WIF) {
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 200 });
} 