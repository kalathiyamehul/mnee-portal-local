import { RateLimitType } from '@prisma/client';
import { CSRFOptions } from './csrf';

/**
 * Helper function to create rate limiting configuration for login-related endpoints
 */
export function createLoginRateLimit(): CSRFOptions {
    return {
        rateLimit: {
            type: 'LOGIN_ATTEMPT',
            identifier: async (request: Request) => {
                try {
                    const body = await request.clone().json();
                    // Use email if available, otherwise fall back to IP
                    return body.email || 'unknown';
                } catch {
                    return 'unknown';
                }
            },
        },
    };
}

/**
 * Helper function to create rate limiting configuration for 2FA endpoints
 */
export function create2FARateLimit(): CSRFOptions {
    return {
        rateLimit: {
            type: 'TWO_FA_ATTEMPT',
            identifier: async (request: Request) => {
                try {
                    const body = await request.clone().json();
                    return body.email || 'unknown';
                } catch {
                    return 'unknown';
                }
            },
        },
    };
}

/**
 * Helper function to create rate limiting configuration for password reset endpoints
 */
export function createPasswordResetRateLimit(): CSRFOptions {
    return {
        rateLimit: {
            type: 'PASSWORD_RESET',
            identifier: async (request: Request) => {
                try {
                    const body = await request.clone().json();
                    return body.email || 'unknown';
                } catch {
                    return 'unknown';
                }
            },
        },
    };
}

/**
 * Helper function to create rate limiting configuration for general API endpoints
 */
export function createAPIRateLimit(maxAttempts?: number): CSRFOptions {
    return {
        rateLimit: {
            type: 'API_REQUEST',
            config: maxAttempts ? { maxAttempts } : undefined,
        },
    };
}

/**
 * Helper function to create rate limiting configuration with custom settings
 */
export function createCustomRateLimit(
    type: RateLimitType,
    identifier?: (request: Request) => string | Promise<string>,
    maxAttempts?: number
): CSRFOptions {
    return {
        rateLimit: {
            type,
            identifier,
            config: maxAttempts ? { maxAttempts } : undefined,
        },
    };
} 