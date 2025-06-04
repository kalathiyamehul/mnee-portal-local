// Import necessary modules
import bcrypt from 'bcrypt';
import { getUserByEmail } from '../lib/prisma';

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

export default authenticateUser;
