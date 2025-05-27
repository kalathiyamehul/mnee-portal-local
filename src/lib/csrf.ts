import csrf from 'csrf';
import { NextResponse } from 'next/server';
import { RateLimitType } from '@prisma/client';
import { checkRateLimit, getClientIP, RateLimitConfig } from './rateLimiter';

const tokens = new csrf();
const CSRF_SECRET = process.env.CSRF_SECRET || "N76P9eIuG68d7GZhKGmvzCD7";

export function generateCSRFToken() {
    return tokens.create(CSRF_SECRET);
}

export function verifyCSRFToken(token: string) {
    return tokens.verify(CSRF_SECRET, token);
}

export interface CSRFOptions {
    rateLimit?: {
        type: RateLimitType;
        identifier?: (request: Request) => string | Promise<string>;
        config?: Partial<RateLimitConfig>;
        skipMethods?: string[]; // Methods to skip rate limiting (default: GET, HEAD, OPTIONS)
    };
}

export function withCSRF(handler: any, options?: CSRFOptions) {
    return async (req: Request, ...args: any[]) => {
        const method = req.method?.toUpperCase();

        // Skip CSRF for safe methods
        const skipCSRFMethods = ['GET', 'HEAD', 'OPTIONS'];
        if (!skipCSRFMethods.includes(method)) {
            const csrfToken = req.headers.get('x-csrf-token') || '';
            if (!csrfToken || !verifyCSRFToken(csrfToken)) {
                return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), { status: 403 });
            }
        }

        // Apply rate limiting if configured
        if (options?.rateLimit) {
            const { type, identifier, config, skipMethods = ['GET', 'HEAD', 'OPTIONS'] } = options.rateLimit;

            // Skip rate limiting for specified methods
            if (!skipMethods.includes(method)) {
                try {
                    // Generate identifier for rate limiting
                    let rateLimitIdentifier: string;

                    if (identifier) {
                        rateLimitIdentifier = await identifier(req);
                    } else {
                        // Default to IP address
                        rateLimitIdentifier = getClientIP(req);
                    }

                    // Check rate limit
                    const rateLimitResult = await checkRateLimit(
                        rateLimitIdentifier,
                        type,
                        config
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
                                    'X-RateLimit-Limit': config?.maxAttempts?.toString() || '100',
                                    'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
                                    'X-RateLimit-Reset': rateLimitResult.resetTime.getTime().toString(),
                                },
                            }
                        );
                    }

                    // Execute the original handler
                    const response = await handler(req, ...args);

                    // Add rate limit headers to successful responses
                    if (response.status < 400) {
                        const headers = new Headers(response.headers);
                        headers.set('X-RateLimit-Limit', config?.maxAttempts?.toString() || '100');
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
                    console.error('Rate limiting error in withCSRF:', error);
                    // If rate limiting fails, continue with the original request
                    return handler(req, ...args);
                }
            }
        }

        return handler(req, ...args);
    };
} 