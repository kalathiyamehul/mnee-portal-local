import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

// Password validation function (matching the one in resetPassword route)
function isPasswordValid(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

async function createUser(email: string) {
  try {
    // Generate a secure random password (24 characters)
    const tempPassword = randomBytes(12).toString('hex');
    
    // Validate the generated password
    const validation = isPasswordValid(tempPassword);
    if (!validation.valid) {
      throw new Error(`Generated password is invalid: ${validation.error}`);
    }
    
    // Hash the password with same cost factor as reset password route
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        requiresPasswordReset: true
      }
    });

    console.log('\nUser created successfully:');
    console.log('Email:', user.email);
    console.log('Temporary password:', tempPassword);
    console.log('\nIMPORTANT:');
    console.log('1. User will be required to change password on first login');
    console.log('2. Password must be changed before accessing the dashboard');
    console.log('3. Share the temporary password securely with the user');

  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        console.error('\nError: User with this email already exists');
      } else {
        console.error('\nError creating user:', error.message);
      }
    } else {
      console.error('\nUnknown error creating user');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.error('\nPlease provide an email address');
  console.error('Usage: npm run create-user user@example.com');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('\nError: Invalid email format');
  process.exit(1);
}

createUser(email); 