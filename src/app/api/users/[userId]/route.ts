import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from '@/lib/csrf';

export const PUT = withCSRF(async function (
    req: Request,
    context: any
) {
    try {
        const session = await getServerSession(authOptions);
        const { userId } = context.params;

        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { name, email, password, roleId } = body;

        if (!name || !email) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Check if email is already taken by another user
        const existingUser = await prisma.user.findFirst({
            where: {
                email,
                id: { not: userId },
            },
        });

        if (existingUser) {
            return new NextResponse("Email already taken", { status: 400 });
        }

        const updateData: any = {
            name,
            email,
            roleId,
        };

        if (password) {
            updateData.password = await hash(password, 12);
        }

        const user = await prisma.user.update({
            where: {
                id: userId,
            },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdAt: true,
            },
        });

        await logActivity(prisma, {
            name: "User Updated",
            action: "USER_UPDATE",
            description: `User ${userId} updated by user ${session.user.email}`,
            metadata: {
                user: JSON.stringify(user),
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_PUT]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
});

export const DELETE = withCSRF(async function (
    req: Request,
    context: any
) {
    try {
        const session = await getServerSession(authOptions);
        const { userId } = context.params;
        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Prevent deleting the last admin user
        const userToDelete = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!userToDelete) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        await prisma.user.delete({
            where: {
                id: userId,
            },
        });

        await logActivity(prisma, {
            name: "User Deleted",
            action: "USER_DELETE",
            description: `User ${userId} deleted by user ${session.user.id}`,
            metadata: {
                userId,
            },
        });

        return NextResponse.json({
            message: "User deleted successfully",
            status: 200,
        }, { status: 200 });
    } catch (error) {
        console.error("[USER_DELETE]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
});