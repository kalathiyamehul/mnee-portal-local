import type { PrismaClient } from '@prisma/client';
import type { TransactionClient } from './prisma';

/**
 * Checks if the system is currently paused by comparing the latest approved PAUSE and RESUME actions.
 * @param prisma PrismaClient instance or transaction client
 * @returns Promise<boolean> true if the system is paused, false otherwise
 */
export async function isSystemPaused(prisma: PrismaClient | TransactionClient) {
  const [pauseRequest, resumeRequest] = await Promise.all([
    prisma.actionRequest.findFirst({
      where: {
        action: 'PAUSE',
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.actionRequest.findFirst({
      where: {
        action: 'RESUME',
        status: 'APPROVED',
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
  ]);

  // System is paused if the latest approved PAUSE is more recent than the latest approved RESUME
  return !!(pauseRequest && (!resumeRequest || pauseRequest.createdAt > resumeRequest.createdAt));
} 