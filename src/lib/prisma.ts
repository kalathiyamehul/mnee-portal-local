// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        // log: ['query'], // Uncomment for debugging
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type UserWithoutPassword = Omit<User, 'password'>;

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        return user;
    } catch (error) {
        console.error(`Error finding user by email ${email}: ${error}`);
        return null;
    }
}
