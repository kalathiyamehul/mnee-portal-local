import { CSRFOptions } from './csrf';
import { RateLimitType } from './rateLimiter';

/**
 * Helper function to create rate limiting configuration for 2FA endpoints
 */
export function create2FARateLimit(): CSRFOptions {
    return {
        rateLimit: {
            type: RateLimitType.API_REQUEST,
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
            type: RateLimitType.API_REQUEST,
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