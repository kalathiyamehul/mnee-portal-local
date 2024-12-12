/*
  Warnings:

  - Made the column `mint_address` on table `config` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fund_address` on table `config` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "burn_approval" DROP CONSTRAINT "burn_approval_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "burn_approval" DROP CONSTRAINT "burn_approval_burn_request_id_fkey";

-- DropForeignKey
ALTER TABLE "burn_request" DROP CONSTRAINT "burn_request_requested_by_fkey";

-- AlterTable
UPDATE "config" SET "mint_address" = '' WHERE "mint_address" IS NULL;
UPDATE "config" SET "fund_address" = '' WHERE "fund_address" IS NULL;
ALTER TABLE "config" ALTER COLUMN "decimals" SET DEFAULT 8,
ALTER COLUMN "mint_address" SET NOT NULL,
ALTER COLUMN "fund_address" SET NOT NULL,
ALTER COLUMN "burn_address" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "burn_request" ADD CONSTRAINT "burn_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burn_approval" ADD CONSTRAINT "burn_approval_burn_request_id_fkey" FOREIGN KEY ("burn_request_id") REFERENCES "burn_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burn_approval" ADD CONSTRAINT "burn_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the blacklist_approval table first
DROP TABLE IF EXISTS "blacklist_approval";

-- Rename blacklist_request table to blacklist
ALTER TABLE "blacklist_request" RENAME TO "blacklist";

-- Remove requires_approval column from blacklist
ALTER TABLE "blacklist" DROP COLUMN IF EXISTS "requires_approval";

-- Set default status to APPROVED for blacklist table
ALTER TABLE "blacklist" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
