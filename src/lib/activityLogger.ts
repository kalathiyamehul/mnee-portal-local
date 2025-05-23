import { PrismaClient, Prisma } from '@prisma/client';

export async function logActivity(
  tx: Prisma.TransactionClient,
  {
    name,
    action,
    description,
    metadata,
  }: {
    name: string;
    action: string;
    description: string;
    metadata: Record<string, any>;
  }
) {
  await tx.activityLog.create({
    data: {
      name,
      action,
      description,
      metadata,
    },
  });
}