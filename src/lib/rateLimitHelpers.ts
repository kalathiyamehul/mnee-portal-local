import { CSRFOptions } from './csrf';
import { RateLimitType } from './rateLimiter';
import crypto from 'crypto';

function generateDeviceFingerprintFromNextAuth(req: any): string {
    const headers = req?.headers || {};

    const fingerprint = [
        headers['user-agent'] || '',
        headers['accept-language'] || '',
        headers['accept-encoding'] || '',
        headers['accept'] || '',
        headers['dnt'] || '',
        headers['sec-ch-ua'] || '',
        headers['sec-ch-ua-platform'] || '',
        headers['sec-ch-ua-mobile'] || '',
    ].join('|');

    return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
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

export function createLoginFingerprint(req: any, email: string): string {
    try {
        // 1. Email prefix for account targeting
        const emailPrefix = email;

        // 2. User agent hash
        const userAgent = req?.headers?.['user-agent'] || 'unknown';
        const userAgentHash = crypto.createHash('md5').update(userAgent).digest('hex').slice(0, 8);

        // 3. Device fingerprint
        const deviceFingerprint = generateDeviceFingerprintFromNextAuth(req);

        // Combine all factors
        return `login:${emailPrefix}:${userAgentHash}:${deviceFingerprint}`;
    } catch (error) {
        console.error('Error generating login fingerprint:', error);
        // Fallback to email-based if fingerprinting fails
        return `fallback:${email}`;
    }
}