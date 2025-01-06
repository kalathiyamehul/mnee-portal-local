import { PrismaClient } from '@prisma/client';
import { Command } from 'commander';

const prisma = new PrismaClient();
const program = new Command();

program
  .name('approve')
  .description('Approve various types of requests')
  .requiredOption('-t, --type <type>', 'Type of request (mint, burn, etc)')
  .requiredOption('-i, --id <id>', 'Request ID')
  .requiredOption('-u, --user <userId>', 'User ID to approve as')
  .parse(process.argv);

const opts = program.opts();

async function approveMint(requestId: string, userId: string) {
  try {
    // Verify the mint request exists and is pending
    const mintRequest = await prisma.mintRequest.findUnique({
      where: { id: requestId },
      include: { approvals: true }
    });

    if (!mintRequest) {
      throw new Error('Mint request not found');
    }

    if (mintRequest.status !== 'PENDING') {
      throw new Error(`Request is not pending (status: ${mintRequest.status})`);
    }

    // Check if user has already approved
    const existingApproval = await prisma.actionApproval.findFirst({
      where: {
        mintRequestId: requestId,
        approvedBy: userId
      }
    });

    if (existingApproval) {
      throw new Error('User has already approved this request');
    }

    // Create the approval
    await prisma.actionApproval.create({
      data: {
        mintRequestId: requestId,
        approvedBy: userId
      }
    });

    console.log('Approval added successfully');

    // Check if we now have enough approvals
    const approvalCount = await prisma.actionApproval.count({
      where: { 
        mintRequestId: requestId,
        approvedBy: {
          not: mintRequest.requestedBy // Exclude requester's approvals
        }
      }
    });

    if (approvalCount >= 2) {
      await prisma.mintRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      });
      console.log('Request now has sufficient approvals (2 non-requester approvals) and has been marked as APPROVED');
    } else {
      console.log(`Request has ${approvalCount} non-requester approval(s), needs 2 for completion`);
    }

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { type, id, user } = opts;

  switch (type.toLowerCase()) {
    case 'mint':
      await approveMint(id, user);
      break;
    default:
      console.error(`Unsupported request type: ${type}`);
      process.exit(1);
  }
}

main(); 