import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { withCSRF } from '@/lib/csrf';
import { unlockAccount, resetRateLimit } from '@/lib/rateLimiter';
import { RateLimitType } from '@prisma/client';
import { createAPIRateLimit } from '@/lib/rateLimitHelpers';
// GET - Get rate limit and lockout status
export const GET = withCSRF(async function (request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const identifier = searchParams.get('identifier');
        const type = searchParams.get('type') as RateLimitType;

        let result: any = {};

        // Get account lockout status
        if (email) {
            const lockoutRecord = await prisma.accountLockout.findUnique({
                where: { email },
            });
            result.accountLockout = lockoutRecord;
        }

        // Get rate limit status
        if (identifier && type) {
            const rateLimitRecord = await prisma.rateLimitAttempt.findUnique({
                where: {
                    identifier_type: {
                        identifier,
                        type,
                    },
                },
            });
            result.rateLimit = rateLimitRecord;
        }

        // Get all locked accounts if no specific email provided
        if (!email && !identifier) {
            const lockedAccounts = await prisma.accountLockout.findMany({
                where: {
                    OR: [
                        { failedAttempts: { gt: 0 } },
                        { lockedUntil: { gt: new Date() } },
                    ],
                },
                orderBy: { lastFailedAt: 'desc' },
                take: 50,
            });

            const activeRateLimits = await prisma.rateLimitAttempt.findMany({
                where: {
                    attempts: { gt: 0 },
                    windowStart: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
                },
                orderBy: { lastAttempt: 'desc' },
                take: 100,
            });

            result = {
                lockedAccounts,
                activeRateLimits,
            };
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error fetching rate limit status:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}, createAPIRateLimit());

// POST - Reset rate limits or unlock accounts
export const POST = withCSRF(async function (request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action, email, identifier, type } = body;

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        switch (action) {
            case 'unlock_account':
                if (!email) {
                    return NextResponse.json({ error: 'Email is required for unlock_account' }, { status: 400 });
                }
                await unlockAccount(email);

                // Log the admin action
                await prisma.activityLog.create({
                    data: {
                        name: 'Account Unlocked',
                        action: 'ADMIN_UNLOCK_ACCOUNT',
                        description: `Account ${email} was unlocked by admin ${session.user.email}`,
                        metadata: {
                            adminUserId: session.user.id,
                            targetEmail: email,
                        },
                    },
                });

                return NextResponse.json({ success: true, message: 'Account unlocked successfully' });

            case 'reset_rate_limit':
                if (!identifier || !type) {
                    return NextResponse.json({ error: 'Identifier and type are required for reset_rate_limit' }, { status: 400 });
                }
                await resetRateLimit(identifier, type as RateLimitType);

                // Log the admin action
                await prisma.activityLog.create({
                    data: {
                        name: 'Rate Limit Reset',
                        action: 'ADMIN_RESET_RATE_LIMIT',
                        description: `Rate limit for ${identifier} (${type}) was reset by admin ${session.user.email}`,
                        metadata: {
                            adminUserId: session.user.id,
                            targetIdentifier: identifier,
                            rateLimitType: type,
                        },
                    },
                });

                return NextResponse.json({ success: true, message: 'Rate limit reset successfully' });

            case 'bulk_unlock':
                // Unlock all currently locked accounts
                const unlockedCount = await prisma.accountLockout.updateMany({
                    where: {
                        OR: [
                            { lockedUntil: { gt: new Date() } },
                            { failedAttempts: { gt: 0 } },
                        ],
                    },
                    data: {
                        failedAttempts: 0,
                        lockedUntil: null,
                        lastFailedAt: null,
                    },
                });

                // Log the admin action
                await prisma.activityLog.create({
                    data: {
                        name: 'Bulk Account Unlock',
                        action: 'ADMIN_BULK_UNLOCK',
                        description: `${unlockedCount.count} accounts were unlocked by admin ${session.user.email}`,
                        metadata: {
                            adminUserId: session.user.id,
                            unlockedCount: unlockedCount.count,
                        },
                    },
                });

                return NextResponse.json({
                    success: true,
                    message: `${unlockedCount.count} accounts unlocked successfully`
                });

            case 'cleanup_old_records':
                // Clean up old rate limit records (older than 24 hours)
                const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const deletedRateLimits = await prisma.rateLimitAttempt.deleteMany({
                    where: {
                        windowStart: { lt: cutoffDate },
                    },
                });

                // Clean up old lockout records with no recent activity
                const deletedLockouts = await prisma.accountLockout.deleteMany({
                    where: {
                        failedAttempts: 0,
                        lockedUntil: null,
                        lastFailedAt: { lt: cutoffDate },
                    },
                });

                // Log the admin action
                await prisma.activityLog.create({
                    data: {
                        name: 'Rate Limit Cleanup',
                        action: 'ADMIN_CLEANUP_RATE_LIMITS',
                        description: `Cleaned up ${deletedRateLimits.count} rate limit records and ${deletedLockouts.count} lockout records by admin ${session.user.email}`,
                        metadata: {
                            adminUserId: session.user.id,
                            deletedRateLimits: deletedRateLimits.count,
                            deletedLockouts: deletedLockouts.count,
                        },
                    },
                });

                return NextResponse.json({
                    success: true,
                    message: `Cleaned up ${deletedRateLimits.count} rate limit records and ${deletedLockouts.count} lockout records`
                });

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        console.error('Error managing rate limits:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}, createAPIRateLimit()); 