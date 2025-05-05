import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pendingRequests = await prisma.mintRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      requester: true,
      approvals: true
    }
  });

  // console.log('\nPending Mint Requests:');
  // console.log('=====================');
  
  for (const request of pendingRequests) {
    const nonRequesterApprovals = request.approvals.filter(
      approval => approval.approvedBy !== request.requestedBy
    );

    console.log(`\nID: ${request.id}`);
    console.log(`Amount: ${request.amount}`);
    console.log(`Address: ${request.address}`);
    console.log(`Requester: ${request.requester.email}`);
    console.log(`Current Non-Requester Approvals: ${nonRequesterApprovals.length} (needs 2)`);
    if (nonRequesterApprovals.length > 0) {
      console.log('Approved by:');
      for (const approval of nonRequesterApprovals) {
        console.log(`  - ${approval.approvedBy}`);
      }
    }
    console.log('---------------------');
  }

  if (pendingRequests.length === 0) {
    console.log('No pending mint requests found.');
  }

  await prisma.$disconnect();
}

main(); 