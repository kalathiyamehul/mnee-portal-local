import { NextResponse } from 'next/server';
import { RateLimitType } from '@prisma/client';
import { checkRateLimit, getClientIP, RateLimitConfig } from './rateLimiter';

export interface RateLimitMiddlewareOptions {
    type: RateLimitType;
    identifier?: (request: Request) => string | Promise<string>;
    config?: Partial<RateLimitConfig>;
    skipSuccessfulRequests?: boolean;
    keyGenerator?: (request: Request) => string | Promise<string>;
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(
    handler: (request: Request, ...args: any[]) => Promise<Response>,
    options: RateLimitMiddlewareOptions
) {
    return async function rateLimitedHandler(request: Request, ...args: any[]): Promise<Response> {
        try {
            // Generate identifier for rate limiting
            let identifier: string;

            if (options.identifier) {
                identifier = await options.identifier(request);
            } else if (options.keyGenerator) {
                identifier = await options.keyGenerator(request);
            } else {
                // Default to IP address
                identifier = getClientIP(request);
            }

            // Check rate limit
            const rateLimitResult = await checkRateLimit(
                identifier,
                options.type,
                options.config
            );

            // If blocked, return rate limit error
            if (rateLimitResult.blocked) {
                const resetTime = rateLimitResult.blockUntil || rateLimitResult.resetTime;
                const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

                return NextResponse.json(
                    {
                        error: 'Too many requests',
                        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
                        retryAfter,
                        resetTime: resetTime.toISOString(),
                    },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': retryAfter.toString(),
                            'X-RateLimit-Limit': options.config?.maxAttempts?.toString() || '100',
                            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                            'X-RateLimit-Reset': rateLimitResult.resetTime.getTime().toString(),
                        },
                    }
                );
            }

            // Execute the original handler
            const response = await handler(request, ...args);

            // Add rate limit headers to successful responses
            if (response.status < 400) {
                const headers = new Headers(response.headers);
                headers.set('X-RateLimit-Limit', options.config?.maxAttempts?.toString() || '100');
                headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
                headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.getTime().toString());

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers,
                });
            }

            return response;
        } catch (error) {
            console.error('Rate limiting middleware error:', error);
            // If rate limiting fails, continue with the original request
            return handler(request, ...args);
        }
    };
}

/**
 * Specific rate limiting middleware for login attempts
 */
export function withLoginRateLimit(
    handler: (request: Request, ...args: any[]) => Promise<Response>
) {
    return withRateLimit(handler, {
        type: 'LOGIN_ATTEMPT',
        identifier: async (request: Request) => {
            // Use IP address as primary identifier for login attempts
            const ip = getClientIP(request);

            // Try to get email from request body for additional tracking
            try {
                const body = await request.clone().json();
                if (body.email) {
                    return `${ip}:${body.email}`;
                }
            } catch {
                // If we can't parse the body, just use IP
            }

            return ip;
        },
    });
}

/**
 * Rate limiting middleware for API requests
 */
export function withAPIRateLimit(
    handler: (request: Request, ...args: any[]) => Promise<Response>,
    config?: Partial<RateLimitConfig>
) {
    return withRateLimit(handler, {
        type: 'API_REQUEST',
        config,
    });
}

/**
 * Rate limiting middleware for password reset attempts
 */
export function withPasswordResetRateLimit(
    handler: (request: Request, ...args: any[]) => Promise<Response>
) {
    return withRateLimit(handler, {
        type: 'PASSWORD_RESET',
        identifier: async (request: Request) => {
            try {
                const body = await request.clone().json();
                return body.email || getClientIP(request);
            } catch {
                return getClientIP(request);
            }
        },
    });
}

/**
 * Rate limiting middleware for 2FA attempts
 */
export function with2FARateLimit(
    handler: (request: Request, ...args: any[]) => Promise<Response>
) {
    return withRateLimit(handler, {
        type: 'TWO_FA_ATTEMPT',
        identifier: async (request: Request) => {
            try {
                const body = await request.clone().json();
                return body.email || getClientIP(request);
            } catch {
                return getClientIP(request);
            }
        },
    });
} 