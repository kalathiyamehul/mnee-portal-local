-- CreateEnum
CREATE TYPE "FreezeAction" AS ENUM ('FREEZE', 'UNFREEZE');

-- DropForeignKey
ALTER TABLE "ActionApproval" DROP CONSTRAINT "ActionApproval_actionRequestId_fkey";

-- AlterTable
ALTER TABLE "ActionApproval" ADD COLUMN     "freezeRequestId" TEXT,
ALTER COLUMN "actionRequestId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "FreezeRequest" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "FreezeAction" NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreezeRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FreezeRequest" ADD CONSTRAINT "FreezeRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionApproval" ADD CONSTRAINT "ActionApproval_actionRequestId_fkey" FOREIGN KEY ("actionRequestId") REFERENCES "ActionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionApproval" ADD CONSTRAINT "ActionApproval_freezeRequestId_fkey" FOREIGN KEY ("freezeRequestId") REFERENCES "FreezeRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
