import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export async function checkPermission(
    userId: string,
    resource: string,
    action: string
): Promise<boolean> {
    try {
        // Check if user is super admin first
        const superAdminRole = await prisma.userRole.findFirst({
            where: {
                userId,
                role: {
                    name: "Super Admin"
                }
            }
        });

        if (superAdminRole) {
            return true;
        }

        // Check specific permissions
        const userRoles = await prisma.userRole.findMany({
            where: { userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        return userRoles.some(userRole =>
            userRole.role.rolePermissions.some(rp =>
                rp.permission.resource === resource &&
                rp.permission.action === action
            )
        );
    } catch (error) {
        console.error("Error checking permissions:", error);
        return false;
    }
}

export async function withPermission(
    handler: Function,
    resource: string,
    action: string
) {
    return async function (request: NextRequest) {
        try {
            const session = await getServerSession(authOptions);

            if (!session?.user?.id) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 401 }
                );
            }

            const hasPermission = await checkPermission(
                session.user.id,
                resource,
                action
            );

            if (!hasPermission) {
                return NextResponse.json(
                    { error: "Forbidden" },
                    { status: 403 }
                );
            }

            return handler(request);
        } catch (error) {
            console.error("Error in permission middleware:", error);
            return NextResponse.json(
                { error: "Internal server error" },
                { status: 500 }
            );
        }
    };
} 