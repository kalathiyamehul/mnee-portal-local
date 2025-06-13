import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { ActivityAction, logActivity } from "@/lib/activityLogger";
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { emitUserSessionInvalidate } from "@/lib/sseEmitter";

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

        if (!email) {
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

        // Check if role is being changed
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { roleId: true }
        });

        const isRoleChanged = currentUser?.roleId !== roleId;
        if (isRoleChanged) {
            updateData.lastRoleUpdatedAt = new Date();
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
            action: ActivityAction.USER_UPDATED,
            metadata: {
                otherUserId: user.id,
                user: JSON.stringify(user),
                roleChanged: isRoleChanged,
            },
        });

        // Emit user session invalidation event if role was changed
        if (isRoleChanged) {
            emitUserSessionInvalidate({
                userIds: [userId],
                reason: 'role_assigned',
                roleId: roleId,
                roleName: user.role?.name || 'No Role'
            });
        }

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USER_PUT]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}, createAPIRateLimit());

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
            action: ActivityAction.USER_DELETED,
            metadata: {
                userId,
                deletedUserEmail: userToDelete.email,
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
}, createAPIRateLimit());