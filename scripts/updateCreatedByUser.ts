import { prisma } from '../src/lib/prisma';

async function updateCreatedByToSuperAdmin() {
  try {
    // Find the first user with no role assigned (super admin)
    const superAdmin = await prisma.user.findFirst({
      where: { roleId: null },
      select: { id: true, email: true }
    });

    if (!superAdmin) {
      console.error('No super admin user found (user with no role assigned).');
      process.exit(1);
    }

    // Update all users where createdBy is null and id is not the super admin's id
    const result = await prisma.user.updateMany({
      where: {
        createdBy: null,
        id: { not: superAdmin.id }
      },
      data: {
        createdBy: superAdmin.email
      }
    });

    console.log(`Updated ${result.count} users. Set createdBy to super admin (${superAdmin.email}, id: ${superAdmin.id}) where it was null.`);
  } catch (error) {
    console.error('Error updating users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateCreatedByToSuperAdmin(); 