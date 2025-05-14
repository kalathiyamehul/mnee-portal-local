-- AlterTable
ALTER TABLE "config" ADD COLUMN     "globalJson" JSONB,
ADD COLUMN     "noOfApproval" INTEGER NOT NULL DEFAULT 2;
