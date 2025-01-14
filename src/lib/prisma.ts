// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'password'>;

export const prisma = new PrismaClient();

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
