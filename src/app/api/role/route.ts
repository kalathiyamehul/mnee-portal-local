import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { logActivity } from "@/lib/activityLogger"; // <-- Add this import
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { Prisma } from "@prisma/client";

// Schema for role creation/update
const roleSchema = z.object({
    name: z.string().min(1, "Role name is required"),
    description: z.string().optional(),
    permissions: z.array(z.object({
        resource: z.string(),
        actions: z.array(z.string())
    })).optional()
});

// GET /api/role - List all roles
export const GET = withCSRF(async function() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const roles = await prisma.role.findMany({
            include: {
                rolePermissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });
        return NextResponse.json(roles);
    } catch (error) {
        console.error("Error fetching roles:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}, createAPIRateLimit())

// POST /api/role - Create new role
export const POST = withCSRF(async function(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const validatedData = roleSchema.parse(body);

        // Create role and its permissions in a transaction
        // Modified transaction block
        const role = await prisma.$transaction(async (tx) => {
            const newRole = await tx.role.create({
                data: {
                    name: validatedData.name.trim(),
                    description: validatedData.description,
                },
            });

            if (validatedData.permissions) {
                const permissionIds = [];
                for (const perm of validatedData.permissions) {
                    for (const action of perm.actions) {
                        const permission = await tx.permission.upsert({
                            where: { resource_action: {
                                resource: perm.resource,
                                action: action,
                            }},
                            create: {
                                name: `${perm.resource}_${action}`,
                                resource: perm.resource,
                                action: action,
                            },
                            update: {},
                        });
                        permissionIds.push(permission.id);
                    }
                }

                // Batch create role permissions
                await tx.rolePermission.createMany({
                    data: permissionIds.map(permissionId => ({
                        roleId: newRole.id,
                        permissionId,
                    })),
                });
            }

            // Return role with permissions
            const createdRole = await tx.role.findUnique({
                where: { id: newRole.id },
                include: {
                    rolePermissions: {
                        include: {
                            permission: true
                        }
                    }
                }
            });

            await logActivity(tx, {
                name: "Role Created",
                action: "ROLE_CREATE",
                description: `Role ${newRole.name} created by user ${session.user.id}`,
                metadata: {
                    role: JSON.stringify(createdRole),
                },
            });

            return createdRole;
        }, { timeout: 300000 });

        if (!role) {
            throw new Error("Failed to create role");
        }

        return NextResponse.json(role, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        // Handle unique constraint violation
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                { error: "A role with this name already exists" },
                { status: 409 }
            );
        }

        console.error("Error creating role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}, createAPIRateLimit())

// PUT /api/role - Update role
export const PUT = withCSRF(async function(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const { id, ...updateData } = body;
        const validatedData = roleSchema.parse(updateData);

        const updatedRole = await prisma.$transaction(async (tx) => {
            // Update role basic info
            const role = await tx.role.update({
                where: { id },
                data: {
                    name: validatedData.name.trim(),
                    description: validatedData.description,
                },
            });

            // If permissions are provided, update them
            if (validatedData.permissions) {
                // Remove existing permissions first
                await tx.rolePermission.deleteMany({
                    where: { roleId: id },
                });

                // Collect all permission IDs first
                const permissionIds = [];
                for (const perm of validatedData.permissions) {
                    for (const action of perm.actions) {
                        const permission = await tx.permission.upsert({
                            where: {
                                resource_action: {
                                    resource: perm.resource,
                                    action: action,
                                }
                            },
                            create: {
                                name: `${perm.resource}_${action}`,
                                resource: perm.resource,
                                action: action,
                            },
                            update: {},
                        });
                        permissionIds.push(permission.id);
                    }
                }

                // Batch create role permissions
                await tx.rolePermission.createMany({
                    data: permissionIds.map(permissionId => ({
                        roleId: id,
                        permissionId,
                    })),
                });
            }

            // Return role with permissions
            return tx.role.findUnique({
                where: { id: role.id },
                include: {
                    rolePermissions: {
                        include: {
                            permission: true
                        }
                    }
                }
            });
        }, { timeout: 300000 });

        if (!updatedRole) {
            throw new Error("Failed to update role");
        }

        return NextResponse.json(updatedRole);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Validation error", details: error.errors },
                { status: 400 }
            );
        }

        // Handle unique constraint violation
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return NextResponse.json(
                { error: "A role with this name already exists" },
                { status: 409 }
            );
        }

        console.error("Error updating role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}, createAPIRateLimit())

// DELETE /api/role - Delete role
export const DELETE = withCSRF(async function(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Role ID is required" },
                { status: 400 }
            );
        }

        // Delete role and its permissions in a transaction
        await prisma.$transaction(async (tx) => {
            // Delete role permissions first
            await tx.rolePermission.deleteMany({
                where: { roleId: id },
            });

            // Delete the role
            await tx.role.delete({
                where: { id },
            });

            await logActivity(tx, {
                name: "Role Deleted",
                action: "ROLE_DELETE",
                description: `Role ${id} deleted by user ${session.user.id}`,
                metadata: {
                    roleId: id,
                },
            });
        });

        return NextResponse.json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}, createAPIRateLimit())