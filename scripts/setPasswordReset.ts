import { prisma } from '../src/lib/prisma';

async function setPasswordReset() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address');
    console.error('Usage: bun run setPasswordReset user@example.com');
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, requiresPasswordReset: true }
    });

    if (!user) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { requiresPasswordReset: true }
    });

    console.log(`Successfully set requiresPasswordReset to true for user: ${email}`);
  } catch (error) {
    console.error('Error updating user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setPasswordReset(); 