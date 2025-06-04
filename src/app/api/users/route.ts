import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { logActivity } from "@/lib/activityLogger";
import { withCSRF } from '@/lib/csrf';
import { createAPIRateLimit } from "@/lib/rateLimitHelpers";

export const GET = withCSRF(async function (req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Get pagination parameters from URL
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "6");
        const skip = (page - 1) * limit;

        // Get total count for pagination
        const total = await prisma.user.count();

        // Get paginated users
        const users = await prisma.user.findMany({
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
            skip,
            take: limit,
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Calculate total pages
        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            users,
            pagination: {
                total,
                page,
                limit,
                totalPages,
            },
        });
    } catch (error) {
        console.error("[USERS_GET]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}, createAPIRateLimit());

export const POST = withCSRF(async function (req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { name, email, password, roleId } = body;

        if (!name || !email || !password) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return new NextResponse("User already exists", { status: 400 });
        }

        const hashedPassword = await hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                roleId,
                requiresPasswordReset: false,
            },
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
                requiresPasswordReset: false,
                createdAt: true,
            },
        });

        await logActivity(prisma, {
            name: "User Created",
            action: "USER_CREATE",
            description: `User ${user.id} created by user ${session.user.id}`,
            metadata: {
                user: JSON.stringify(user),
            },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error("[USERS_POST]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}, createAPIRateLimit());