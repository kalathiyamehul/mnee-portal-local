import { prisma } from './prisma';
import { RateLimitType } from '@prisma/client';

export interface RateLimitConfig {
    windowMs: number; // Time window in milliseconds
    maxAttempts: number; // Maximum attempts per window
    blockDurationMs?: number; // How long to block after exceeding limit
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    resetTime: Date;
    blocked: boolean;
    blockUntil?: Date;
}

// Default configurations for different types of rate limiting
export const RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
    LOGIN_ATTEMPT: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxAttempts: 5, // 5 attempts per 15 minutes
        blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
    },
    API_REQUEST: {
        windowMs: 60 * 1000, // 1 minute
        maxAttempts: 100, // 100 requests per minute
        blockDurationMs: 5 * 60 * 1000, // Block for 5 minutes
    },
    PASSWORD_RESET: {
        windowMs: 60 * 60 * 1000, // 1 hour
        maxAttempts: 3, // 3 attempts per hour
        blockDurationMs: 60 * 60 * 1000, // Block for 1 hour
    },
    TWO_FA_ATTEMPT: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        maxAttempts: 5, // 5 attempts per 5 minutes
        blockDurationMs: 15 * 60 * 1000, // Block for 15 minutes
    },
};

/**
 * Check and update rate limit for a given identifier and type
 */
export async function checkRateLimit(
    identifier: string,
    type: RateLimitType,
    config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
    const finalConfig = { ...RATE_LIMIT_CONFIGS[type], ...config };
    const now = new Date();
    const windowStart = new Date(now.getTime() - finalConfig.windowMs);

    try {
        // Clean up old records first
        await cleanupOldRateLimitRecords(type, windowStart);

        // Get or create rate limit record
        const record = await prisma.rateLimitAttempt.upsert({
            where: {
                identifier_type: {
                    identifier,
                    type,
                },
            },
            update: {
                attempts: {
                    increment: 1,
                },
                lastAttempt: now,
            },
            create: {
                identifier,
                type,
                attempts: 1,
                windowStart: now,
                lastAttempt: now,
            },
        });

        // Check if we need to reset the window
        if (record.windowStart < windowStart) {
            const updatedRecord = await prisma.rateLimitAttempt.update({
                where: {
                    identifier_type: {
                        identifier,
                        type,
                    },
                },
                data: {
                    attempts: 1,
                    windowStart: now,
                    lastAttempt: now,
                },
            });

            return {
                success: true,
                remaining: finalConfig.maxAttempts - 1,
                resetTime: new Date(now.getTime() + finalConfig.windowMs),
                blocked: false,
            };
        }

        // Check if limit exceeded
        if (record.attempts > finalConfig.maxAttempts) {
            const blockUntil = finalConfig.blockDurationMs
                ? new Date(record.lastAttempt.getTime() + finalConfig.blockDurationMs)
                : new Date(record.windowStart.getTime() + finalConfig.windowMs);

            return {
                success: false,
                remaining: 0,
                resetTime: new Date(record.windowStart.getTime() + finalConfig.windowMs),
                blocked: true,
                blockUntil,
            };
        }

        return {
            success: true,
            remaining: finalConfig.maxAttempts - record.attempts,
            resetTime: new Date(record.windowStart.getTime() + finalConfig.windowMs),
            blocked: false,
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        // Fail open - allow the request if there's a database error
        return {
            success: true,
            remaining: finalConfig.maxAttempts - 1,
            resetTime: new Date(now.getTime() + finalConfig.windowMs),
            blocked: false,
        };
    }
}

/**
 * Reset rate limit for a specific identifier and type
 */
export async function resetRateLimit(identifier: string, type: RateLimitType): Promise<void> {
    try {
        await prisma.rateLimitAttempt.delete({
            where: {
                identifier_type: {
                    identifier,
                    type,
                },
            },
        });
    } catch (error) {
        // Record might not exist, which is fine
        console.log('Rate limit record not found for reset:', { identifier, type });
    }
}

/**
 * Clean up old rate limit records
 */
async function cleanupOldRateLimitRecords(type: RateLimitType, cutoffDate: Date): Promise<void> {
    try {
        await prisma.rateLimitAttempt.deleteMany({
            where: {
                type,
                windowStart: {
                    lt: cutoffDate,
                },
            },
        });
    } catch (error) {
        console.error('Failed to cleanup old rate limit records:', error);
    }
}

/**
 * Account lockout functionality for login attempts
 */
export interface AccountLockoutConfig {
    maxFailedAttempts: number;
    lockoutDurationMs: number;
    resetSuccessfulLogin: boolean;
}

export const DEFAULT_LOCKOUT_CONFIG: AccountLockoutConfig = {
    maxFailedAttempts: 5,
    lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
    resetSuccessfulLogin: true,
};

export interface AccountLockoutResult {
    isLocked: boolean;
    failedAttempts: number;
    lockedUntil?: Date;
    remainingAttempts: number;
}

/**
 * Check if account is locked and update failed attempts
 */
export async function checkAccountLockout(
    email: string,
    isSuccessfulLogin: boolean = false,
    config: Partial<AccountLockoutConfig> = {}
): Promise<AccountLockoutResult> {
    const finalConfig = { ...DEFAULT_LOCKOUT_CONFIG, ...config };
    const now = new Date();

    try {
        const lockoutRecord = await prisma.accountLockout.upsert({
            where: { email },
            update: {},
            create: {
                email,
                failedAttempts: 0,
            },
        });

        // Check if currently locked and lock period has expired
        if (lockoutRecord.lockedUntil && lockoutRecord.lockedUntil > now) {
            return {
                isLocked: true,
                failedAttempts: lockoutRecord.failedAttempts,
                lockedUntil: lockoutRecord.lockedUntil ?? undefined,
                remainingAttempts: 0,
            };
        }

        // Handle successful login
        if (isSuccessfulLogin && finalConfig.resetSuccessfulLogin) {
            await prisma.accountLockout.update({
                where: { email },
                data: {
                    failedAttempts: 0,
                    lockedUntil: null,
                    lastFailedAt: null,
                },
            });

            return {
                isLocked: false,
                failedAttempts: 0,
                remainingAttempts: finalConfig.maxFailedAttempts,
            };
        }

        // Handle failed login
        if (!isSuccessfulLogin) {
            const newFailedAttempts = lockoutRecord.failedAttempts + 1;
            const shouldLock = newFailedAttempts >= finalConfig.maxFailedAttempts;
            const lockedUntil = shouldLock ? new Date(now.getTime() + finalConfig.lockoutDurationMs) : null;

            await prisma.accountLockout.update({
                where: { email },
                data: {
                    failedAttempts: newFailedAttempts,
                    lastFailedAt: now,
                    lockedUntil,
                },
            });

            return {
                isLocked: shouldLock,
                failedAttempts: newFailedAttempts,
                lockedUntil: lockedUntil ?? undefined,
                remainingAttempts: Math.max(0, finalConfig.maxFailedAttempts - newFailedAttempts),
            };
        }

        // Just checking status, no update needed
        return {
            isLocked: false,
            failedAttempts: lockoutRecord.failedAttempts,
            remainingAttempts: Math.max(0, finalConfig.maxFailedAttempts - lockoutRecord.failedAttempts),
        };
    } catch (error) {
        console.error('Account lockout check failed:', error);
        // Fail open - allow the request if there's a database error
        return {
            isLocked: false,
            failedAttempts: 0,
            remainingAttempts: finalConfig.maxFailedAttempts,
        };
    }
}

/**
 * Manually unlock an account (for admin use)
 */
export async function unlockAccount(email: string): Promise<void> {
    try {
        await prisma.accountLockout.update({
            where: { email },
            data: {
                failedAttempts: 0,
                lockedUntil: null,
                lastFailedAt: null,
            },
        });
    } catch (error) {
        console.error('Failed to unlock account:', error);
        throw new Error('Failed to unlock account');
    }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
    // Check various headers for the real IP
    const headers = request.headers;

    const xForwardedFor = headers.get('x-forwarded-for');
    if (xForwardedFor) {
        return xForwardedFor.split(',')[0].trim();
    }

    const xRealIP = headers.get('x-real-ip');
    if (xRealIP) {
        return xRealIP;
    }

    const cfConnectingIP = headers.get('cf-connecting-ip');
    if (cfConnectingIP) {
        return cfConnectingIP;
    }

    // Fallback to a default value if no IP can be determined
    return 'unknown';
} 