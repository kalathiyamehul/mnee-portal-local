// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

// model User {
//     id             String   @id @default(cuid())
//     name           String?
//     email          String   @unique
//     image           String?
//     emailVerified  DateTime?
//     idAddress      String
//     password       String
//     createdAt      DateTime @default(now())
//     updatedAt      DateTime @updatedAt
//   }

type User = {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    emailVerified: Date | null;
    idAddress: string | null;
    password: string;
    createdAt: Date;
    updatedAt: Date;
};

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
