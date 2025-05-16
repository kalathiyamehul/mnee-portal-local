import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";

const assignRoleSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    roleId: z.string().min(1, "Role ID is required"),
});

// POST /api/role/assign - Assign role to user
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const validatedData = assignRoleSchema.parse(body);

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { id: validatedData.userId },
        });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Check if role exists
        const role = await prisma.role.findUnique({
            where: { id: validatedData.roleId },
        });

        if (!role) {
            return NextResponse.json(
                { error: "Role not found" },
                { status: 404 }
            );
        }

        // Assign role to user
        const userRole = await prisma.user.update({
            where: { id: validatedData.userId },
            data: {
                roleId: validatedData.roleId,
            },
            include: {
                role: true,
            },
        });

        return NextResponse.json(userRole, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        // Handle unique constraint violation
        if (error instanceof Error && error.message.includes("P2002")) {
            return NextResponse.json(
                { error: "User already has this role" },
                { status: 400 }
            );
        }

        console.error("Error assigning role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/role/assign - Remove role from user
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("userId");
        const roleId = searchParams.get("roleId");

        if (!userId || !roleId) {
            return NextResponse.json(
                { error: "User ID and Role ID are required" },
                { status: 400 }
            );
        }

        // Delete the role assignment
        await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                roleId: null,
            },
        });

        return NextResponse.json({ message: "Role removed successfully" });
    } catch (error) {
        if (error instanceof Error && error.message.includes("P2025")) {
            return NextResponse.json(
                { error: "Role assignment not found" },
                { status: 404 }
            );
        }

        console.error("Error removing role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
} 