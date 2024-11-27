// src/app/api/token/[tokenId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import type { BSV21 } from "@/types/bsv21";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ tokenId: string }> }
  ) {
    const { tokenId } = await context.params;

  try {
    // Fetch token details from the Gorillapool API
    const gorillapoolUrl = `https://ordinals.gorillapool.io/api/bsv20/id/${tokenId}`;
    const response = await fetch(gorillapoolUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Invalid token ID or token not found." },
        { status: response.status }
      );
    }

    const tokenDetails: BSV21 = await response.json();

    // Return the token details
    return NextResponse.json(tokenDetails);
  } catch (error) {
    console.error("Error fetching token details:", error);
    return NextResponse.json(
      { error: "Error fetching token details." },
      { status: 500 }
    );
  }
}