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

export default authenticateUser;
