import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { isPasswordValid } from '../src/utils/auth';

async function createUser(email: string) {
  try {
    // Generate a secure random password that meets requirements
    let tempPassword = '';
    let validation: { valid: boolean; error?: string } = { valid: false };
    while (!validation.valid) {
      // 16 chars: 8 random bytes as hex, plus 1 uppercase, 1 lowercase, 1 number, 1 special char
      const base = randomBytes(8).toString('hex');
      const upper = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      const lower = String.fromCharCode(97 + Math.floor(Math.random() * 26));
      const number = String.fromCharCode(48 + Math.floor(Math.random() * 10));
      const specials = '!@#$%^&*()_+-=~[]{}|;:,.<>?';
      const special = specials[Math.floor(Math.random() * specials.length)];
      // Shuffle the password
      const arr = (base + upper + lower + number + special).split('');
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      tempPassword = arr.join('');
      validation = isPasswordValid(tempPassword);
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