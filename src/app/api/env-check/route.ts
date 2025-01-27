import { NextResponse } from "next/server";
import { getMintWif, getBurnWif } from "@/env";

export async function HEAD() {
  if (!getMintWif() || !getBurnWif()) {
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 200 });
} 