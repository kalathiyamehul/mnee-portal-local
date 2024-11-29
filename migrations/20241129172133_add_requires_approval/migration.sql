-- AlterEnum
ALTER TYPE "FreezeAction" ADD VALUE 'BLACKLIST';

-- AlterTable
ALTER TABLE "ActionApproval" ADD COLUMN     "mintRequestId" TEXT;

-- AlterTable
ALTER TABLE "FreezeRequest" ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MintRequest" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "minterTx" TEXT,
    "latestMinterTx" TEXT,

    CONSTRAINT "MintRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MintRequest" ADD CONSTRAINT "MintRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionApproval" ADD CONSTRAINT "ActionApproval_mintRequestId_fkey" FOREIGN KEY ("mintRequestId") REFERENCES "MintRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
