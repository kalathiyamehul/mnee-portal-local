import { prisma } from '../src/lib/prisma';

async function checkUser(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        requiresPasswordReset: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      console.error('\nUser not found');
      process.exit(1);
    }

    console.log('\nUser state:');
    console.log('ID:', user.id);
    console.log('Email:', user.email);
    console.log('Requires Password Reset:', user.requiresPasswordReset);
    console.log('Created:', user.createdAt);
    console.log('Last Updated:', user.updatedAt);

  } catch (error) {
    console.error('\nError checking user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.error('\nPlease provide an email address');
  console.error('Usage: npm run check-user user@example.com');
  process.exit(1);
}

checkUser(email); 