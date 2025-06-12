import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";
import { ActivityAction, logActivity } from "@/lib/activityLogger"; // <-- Add this import
import { withCSRF } from "@/lib/csrf";
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";
import { Prisma } from "@prisma/client";
import { emitRoleUpdate, emitUserSessionInvalidate } from "@/lib/sseEmitter";

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
            },
            orderBy: {
                createdAt: "desc"
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
                action: ActivityAction.ROLE_CREATED,
                metadata: {
                    roleName: newRole.name,
                    role: JSON.stringify(createdRole),
                },
            });

            return createdRole;
        }, { timeout: 300000 });

        if (!role) {
            throw new Error("Failed to create role");
        }

        // Emit role update event
        emitRoleUpdate({
            roleId: role.id,
            roleName: role.name,
            action: 'created'
        });

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
            // Get users with this role before updating
            const usersWithRole = await tx.user.findMany({
                where: { roleId: id },
                select: { id: true }
            });

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

            // Update lastRoleUpdatedAt for all users with this role
            if (usersWithRole.length > 0) {
                await tx.user.updateMany({
                    where: { roleId: id },
                    data: { lastRoleUpdatedAt: new Date() }
                });
            }

            await logActivity(tx, {
                action: ActivityAction.ROLE_UPDATED,
                metadata: {
                    roleId: id,
                    roleName: role.name,
                    affectedUsers: usersWithRole.length,
                },
            });

            // Return role with permissions
            return {
                role: await tx.role.findUnique({
                    where: { id: role.id },
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }),
                affectedUserIds: usersWithRole.map(u => u.id)
            };
        }, { timeout: 300000 });

        if (!updatedRole.role) {
            throw new Error("Failed to update role");
        }

        // Emit role update event
        emitRoleUpdate({
            roleId: updatedRole.role.id,
            roleName: updatedRole.role.name,
            action: 'updated',
            affectedUserIds: updatedRole.affectedUserIds
        });

        // Emit user session invalidation event for affected users
        if (updatedRole.affectedUserIds.length > 0) {
            emitUserSessionInvalidate({
                userIds: updatedRole.affectedUserIds,
                reason: 'role_updated',
                roleId: updatedRole.role.id,
                roleName: updatedRole.role.name
            });
        }

        return NextResponse.json(updatedRole.role);
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

        // Check if role exists and get users with this role
        const roleCheck = await prisma.$transaction(async (tx) => {
        // Get role info
            const roleToDelete = await tx.role.findUnique({
                where: { id },
                select: { name: true }
            });

            if (!roleToDelete) {
                throw new Error("Role not found");
            }

            // Get users with this role
            const usersWithRole = await tx.user.findMany({
                where: { roleId: id },
                select: { id: true, email: true, name: true }
            });

            return {
                role: roleToDelete,
                users: usersWithRole
            };
        });

        // Validate that no users are assigned to this role
        if (roleCheck.users.length > 0) {
            return NextResponse.json(
                {
                    error: `This role is currently assigned to ${roleCheck.users.length} user(s). Please reassign or remove these users before deleting the role.`,
                    assignedUsers: roleCheck.users.map(user => ({
                        id: user.id,
                        name: user.name,
                        email: user.email
                    }))
                },
                { status: 409 }
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
                action: ActivityAction.ROLE_DELETED,
                metadata: {
                    roleId: id,
                    roleName: roleCheck.role.name,
                    affectedUsers: 0, // No users affected since we validated none exist
                },
            });
        });

        // Emit role update event
        emitRoleUpdate({
            roleId: id,
            roleName: roleCheck.role.name,
            action: 'deleted',
            affectedUserIds: [] // No users affected since we validated none exist
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