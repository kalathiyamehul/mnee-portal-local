import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const config = await prisma.config.findUnique({
        where: { id: 1 },
    });
    return NextResponse.json(config);
}