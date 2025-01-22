import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';

const program = new Command();
const prisma = new PrismaClient();

program
  .requiredOption('-i, --id <id>', 'Mint request ID to delete')
  .parse(process.argv);

const options = program.opts();

async function deleteMintRequest() {
  try {
    const result = await prisma.mintRequest.delete({
      where: {
        id: options.id
      }
    });
    console.log('Successfully deleted mint request:', result.id);
  } catch (error) {
    console.error('Failed to delete mint request:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteMintRequest(); 