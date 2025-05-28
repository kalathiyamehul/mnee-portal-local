// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { initializeEnv } from "@/env";
import { checkRateLimit, getClientIP } from "@/lib/rateLimiter";
import { NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";

const handler = NextAuth(authOptions);

// Rate limiting wrapper for NextAuth (without CSRF)
function withRateLimit(nextAuthHandler: any) {
    return async (req: Request, context: any) => {
        const method = req.method?.toUpperCase();
        if (method === 'POST') {
            try {
                const identifier = getClientIP(req);
                const rateLimitResult = await checkRateLimit(
                    identifier,
                    'LOGIN_ATTEMPT'
                );
                if (rateLimitResult.blocked) {
                    const resetTime = rateLimitResult.blockUntil || rateLimitResult.resetTime;
                    const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

                    return NextResponse.json(
                        {
                            error: 'Too many login attempts',
                            message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                            retryAfter,
                            resetTime: resetTime.toISOString(),
                        },
                        {
                            status: 429,
                            headers: {
                                'Retry-After': retryAfter.toString(),
                                'X-RateLimit-Limit': '5',
                                'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                                'X-RateLimit-Reset': rateLimitResult.resetTime.getTime().toString(),
                            },
                        }
                    );
                }
            } catch (error) {
                console.error('Rate limiting error in NextAuth:', error);
            }
        }
        return nextAuthHandler(req, context);
    };
}

// Apply rate limiting to login attempts
const protectedHandler = withRateLimit(handler);

export { protectedHandler as GET, protectedHandler as POST };

// Use prisma instance
// import { getSession } from "next-auth/react";

// Use prisma instance
// const session = await getSession();
// const email = session?.user?.email;
// if (email) {
//   const user = await prisma.user.findUnique({
//     where: { email },
//   });
// }