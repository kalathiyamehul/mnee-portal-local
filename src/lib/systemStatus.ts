import type { PrismaClient, Prisma } from '@prisma/client';

export enum SystemOperation {
  // Mint operations
  MINT_REQUEST_CREATE = 'mint request creation',
  MINT_REQUEST_APPROVE = 'mint request approval',
  
  // Burn operations
  BURN_REQUEST_CREATE = 'burn request creation',
  BURN_REQUEST_APPROVE = 'burn request approval',
  
  // Refund operations
  REFUND_REQUEST_CREATE = 'refund request creation',
  REFUND_REQUEST_APPROVE = 'refund request approval',
  
  // Freeze operations
  FREEZE_REQUEST_CREATE = 'freeze request creation',
  FREEZE_REQUEST_APPROVE = 'freeze request approval',
  
  // Blacklist operations
  BLACKLIST_REQUEST_CREATE = 'blacklist request creation',
  BLACKLIST_REQUEST_APPROVE = 'blacklist request approval',
}

// Operations that require blacklist checks
const BLACKLIST_RESTRICTED_OPERATIONS = new Set([
  SystemOperation.MINT_REQUEST_CREATE,
  SystemOperation.MINT_REQUEST_APPROVE,
  SystemOperation.BURN_REQUEST_CREATE,
  SystemOperation.BURN_REQUEST_APPROVE,
  SystemOperation.REFUND_REQUEST_CREATE,
  SystemOperation.REFUND_REQUEST_APPROVE,
]);

/**
 * Checks if the system is currently paused by comparing the latest approved PAUSE and RESUME actions.
 * @param prisma PrismaClient instance or transaction client
 * @returns Promise<boolean> true if the system is paused, false otherwise
 */
export async function isSystemPaused(prisma: PrismaClient | Prisma.TransactionClient) {
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

/**
 * Checks if an address is blacklisted by looking for the latest approved blacklist request.
 * @param prisma PrismaClient instance or transaction client
 * @param address The address to check
 * @returns Promise<boolean> true if the address is blacklisted, false otherwise
 */
export async function isAddressBlacklisted(prisma: PrismaClient | Prisma.TransactionClient, address: string) {
  const blacklistRequest = await prisma.blacklistRequest.findFirst({
    where: {
      address,
      status: 'APPROVED',
      action: 'BLACKLIST',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return !!blacklistRequest;
}

interface SystemCheckOptions {
  address?: string;
  operation: SystemOperation;
}

interface SystemCheckResult {
  isValid: boolean;
  error?: string;
}

/**
 * Performs system-wide checks including system pause and optional address blacklist check.
 * @param prisma PrismaClient instance or transaction client
 * @param options Options including optional address to check and operation name
 * @returns Promise<SystemCheckResult> Result indicating if checks passed and any error message
 */
export async function performSystemChecks(
  prisma: PrismaClient | Prisma.TransactionClient,
  options: SystemCheckOptions
): Promise<SystemCheckResult> {
  // Always check if system is paused
  const isPaused = await isSystemPaused(prisma);
  if (isPaused) {
    return {
      isValid: false,
      error: `System is paused. Cannot ${options.operation} at this time.`
    };
  }

  // Only check blacklist for specific operations
  if (options.address && BLACKLIST_RESTRICTED_OPERATIONS.has(options.operation)) {
    const isBlacklisted = await isAddressBlacklisted(prisma, options.address);
    if (isBlacklisted) {
      return {
        isValid: false,
        error: `Cannot ${options.operation}: the address is blacklisted`
      };
    }
  }

  return { isValid: true };
} 