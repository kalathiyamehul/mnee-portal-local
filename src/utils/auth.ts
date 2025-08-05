// Import necessary modules
import bcrypt from 'bcrypt';
import { getUserByEmail } from '../lib/prisma';
import { prisma } from '../lib/prisma';

/**
 * Authenticates a user by email and password.
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @returns {User|null} - Returns user object if authentication is successful; otherwise, null.
 */
async function authenticateUser(email: string, password: string) {
  // Retrieve user from the database by email
  const user = await getUserByEmail(email);
  if (!user) {
    return null; // User not found
  }

  // Compare provided password with the stored hashed password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    return null; // Invalid password
  }

  // Authentication successful
  return user;
}

/**
 * Validates password complexity.
 * - At least 8 characters
 * - At least one special character
 * - At least one number
 * - At least one uppercase and one lowercase letter
 * - Not a common password (e.g., 'password', '123456', etc.)
 * @param password
 * @returns { valid: boolean, error?: string }
 */
export function isPasswordValid(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', '111111', '123123',
    'password1', '1234', '12345', '12345678', 'iloveyou', 'admin', 'welcome',
    'monkey', 'login', 'letmein', 'football', 'baseball', 'starwars', 'dragon',
    'passw0rd', 'master', 'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1'
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Password is too common. Please choose a more secure password.' };
  }
  return { valid: true };
}

export async function isPasswordReused(userId: string, password: string, maxHistoryCount: number = 5): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (user) {
      const isCurrentPassword = await bcrypt.compare(password, user.password);
      if (isCurrentPassword) {
        return true;
      }
    }

    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: maxHistoryCount,
      select: { password: true }
    });

    for (const historicalPassword of passwordHistory) {
      const isMatch = await bcrypt.compare(password, historicalPassword.password);
      if (isMatch) {
        return true;
      }
    }

    return false;
  } catch (error) {
    return true;
  }
}

export async function updatePasswordWithHistory(userId: string, newHashedPassword: string, maxHistoryCount: number = 5): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (user) {
        await tx.passwordHistory.create({
          data: {
            userId,
            password: user.password
          }
        });

        const oldPasswords = await tx.passwordHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: maxHistoryCount,
          select: { id: true }
        });

        if (oldPasswords.length > 0) {
          await tx.passwordHistory.deleteMany({
            where: {
              id: {
                in: oldPasswords.map(p => p.id)
              }
            }
          });
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          password: newHashedPassword,
          passwordChangedAt: new Date()
        }
      });
    });
  } catch (error) {
    throw new Error('Failed to update password');
  }
}

export default authenticateUser;
