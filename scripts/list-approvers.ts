import { PrismaClient } from '@prisma/client';
import { Command } from 'commander';

const prisma = new PrismaClient();
const program = new Command();

program
  .name('list-approvers')
  .description('List eligible approvers for a request')
  .requiredOption('-i, --id <id>', 'Request ID')
  .parse(process.argv);

const opts = program.opts();

async function main() {
  const { id } = opts;

  try {
    // Get the mint request
    const mintRequest = await prisma.mintRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        approvals: {
          include: {
            approver: true
          }
        }
      }
    });

    if (!mintRequest) {
      throw new Error('Mint request not found');
    }

    // Get all users
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: mintRequest.requestedBy // Exclude requester
        }
      }
    });

    // console.log('\nMint Request Details:');
    // console.log('====================');
    // console.log(`ID: ${mintRequest.id}`);
    // console.log(`Amount: ${mintRequest.amount}`);
    // console.log(`Requester: ${mintRequest.requester.email}`);
    // console.log('\nCurrent Approvers:');
    // for (const approval of mintRequest.approvals) {
    //   console.log(`- ${approval.approver.email} (${approval.approvedBy})`);
    // }

    // console.log('\nEligible Approvers:');
    // console.log('==================');
    const existingApproverIds = mintRequest.approvals.map(a => a.approvedBy);
    const eligibleUsers = users.filter(user => !existingApproverIds.includes(user.id));
    
    for (const user of eligibleUsers) {
      console.log(`- ${user.email} (${user.id})`);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 