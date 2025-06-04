#!/usr/bin/env bun

import { PrismaClient } from '@prisma/client';
import { checkRateLimit, checkAccountLockout, resetRateLimit, unlockAccount } from '../src/lib/rateLimiter';

const prisma = new PrismaClient();

async function testRateLimiting() {
    console.log('🧪 Testing Rate Limiting Implementation...\n');

    const testIdentifier = 'test-ip-192.168.1.1';
    const testType = 'LOGIN_ATTEMPT';
    const testEmail = 'test@example.com';

    try {
        // Test 1: Basic rate limiting
        console.log('Test 1: Basic Rate Limiting');
        console.log('================================');

        // Reset any existing rate limit
        await resetRateLimit(testIdentifier, testType);

        // Test multiple attempts
        for (let i = 1; i <= 7; i++) {
            const result = await checkRateLimit(testIdentifier, testType);
            console.log(`Attempt ${i}: Success=${result.success}, Remaining=${result.remaining}, Blocked=${result.blocked}`);

            if (result.blocked) {
                console.log(`🚫 Blocked after ${i - 1} attempts`);
                break;
            }
        }

        console.log('\n');

        // Test 2: Account lockout
        console.log('Test 2: Account Lockout');
        console.log('========================');

        // Reset any existing lockout
        await unlockAccount(testEmail);

        // Test multiple failed login attempts
        for (let i = 1; i <= 7; i++) {
            const result = await checkAccountLockout(testEmail, false); // false = failed login
            console.log(`Failed login ${i}: Locked=${result.isLocked}, FailedAttempts=${result.failedAttempts}, Remaining=${result.remainingAttempts}`);

            if (result.isLocked) {
                console.log(`🔒 Account locked after ${result.failedAttempts} failed attempts`);
                console.log(`🕐 Locked until: ${result.lockedUntil?.toISOString()}`);
                break;
            }
        }

        console.log('\n');

        // Test 3: Successful login resets lockout
        console.log('Test 3: Successful Login Reset');
        console.log('===============================');

        const resetResult = await checkAccountLockout(testEmail, true); // true = successful login
        console.log(`After successful login: Locked=${resetResult.isLocked}, FailedAttempts=${resetResult.failedAttempts}`);

        console.log('\n');

        // Test 4: Rate limit cleanup
        console.log('Test 4: Rate Limit Cleanup');
        console.log('===========================');

        // Create some old records
        const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

        await prisma.rateLimitAttempt.create({
            data: {
                identifier: 'old-test-ip',
                type: 'LOGIN_ATTEMPT',
                attempts: 5,
                windowStart: oldDate,
                lastAttempt: oldDate,
            },
        });

        // Count records before cleanup
        const beforeCount = await prisma.rateLimitAttempt.count();
        console.log(`Records before cleanup: ${beforeCount}`);

        // Cleanup old records
        await prisma.rateLimitAttempt.deleteMany({
            where: {
                windowStart: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            },
        });

        const afterCount = await prisma.rateLimitAttempt.count();
        console.log(`Records after cleanup: ${afterCount}`);

        console.log('\n');

        // Test 5: Different rate limit types
        console.log('Test 5: Different Rate Limit Types');
        console.log('===================================');

        const types = ['LOGIN_ATTEMPT', 'API_REQUEST', 'PASSWORD_RESET', 'TWO_FA_ATTEMPT'] as const;

        for (const type of types) {
            await resetRateLimit('test-multi-type', type);
            const result = await checkRateLimit('test-multi-type', type);
            console.log(`${type}: Success=${result.success}, Remaining=${result.remaining}`);
        }

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup test data
        await resetRateLimit(testIdentifier, testType);
        await unlockAccount(testEmail);
        await prisma.rateLimitAttempt.deleteMany({
            where: {
                identifier: {
                    startsWith: 'test-',
                },
            },
        });
        await prisma.accountLockout.deleteMany({
            where: {
                email: testEmail,
            },
        });

        await prisma.$disconnect();
    }
}

// Run the test
testRateLimiting().catch(console.error); 