// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export type User = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: Date | null;
  password: string;
  createdAt: Date;
  updatedAt: Date;
};

export type UserWithoutPassword = Omit<User, 'password'> & {
  password: null;
};

export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export const prisma = new PrismaClient();

export async function getUserByEmail(email: string): Promise<User | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        return user;
    } catch (error) {
        console.error('Error retrieving user:', error);
        return null;
    }
}
