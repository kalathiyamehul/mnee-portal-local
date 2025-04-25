import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { z } from "zod";

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
export async function GET() {
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
}

// POST /api/role - Create new role
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await request.json();
        const validatedData = roleSchema.parse(body);

        // Create role and its permissions in a transaction
        const role = await prisma.$transaction(async (tx) => {
            // Create the role
            const newRole = await tx.role.create({
                data: {
                    name: validatedData.name,
                    description: validatedData.description,
                },
            });

            // If permissions are provided, create them and link to the role
            if (validatedData.permissions) {
                for (const perm of validatedData.permissions) {
                    for (const action of perm.actions) {
                        // Find or create permission
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

                        // Link permission to role
                        await tx.rolePermission.create({
                            data: {
                                roleId: newRole.id,
                                permissionId: permission.id,
                            },
                        });
                    }
                }
            }

            // Return role with permissions
            return tx.role.findUnique({
                where: { id: newRole.id },
                include: {
                    rolePermissions: {
                        include: {
                            permission: true
                        }
                    }
                }
            });
        });

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
        if (error instanceof Error && error.message.includes("P2002")) {
            return NextResponse.json(
                { error: "A role with this name already exists" },
                { status: 400 }
            );
        }

        console.error("Error creating role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PUT /api/role - Update role
export async function PUT(request: NextRequest) {
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
                    name: validatedData.name,
                    description: validatedData.description,
                },
            });

            // If permissions are provided, update them
            if (validatedData.permissions) {
                // Remove existing permissions
                await tx.rolePermission.deleteMany({
                    where: { roleId: id },
                });

                // Add new permissions
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

                        await tx.rolePermission.create({
                            data: {
                                roleId: id,
                                permissionId: permission.id,
                            },
                        });
                    }
                }
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
        });

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
        if (error instanceof Error && error.message.includes("P2002")) {
            return NextResponse.json(
                { error: "A role with this name already exists" },
                { status: 400 }
            );
        }

        console.error("Error updating role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// DELETE /api/role - Delete role
export async function DELETE(request: NextRequest) {
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
        });

        return NextResponse.json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
} 