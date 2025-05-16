/*
  Warnings:

  - The values [SETTLEMENT] on the enum `ActionStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `noOfApproval` on the `config` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ActionStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'DONE', 'FAILED', 'REFUNDED', 'SETTLED');
ALTER TABLE "action_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "blacklist_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "burn_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "freeze_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "mint_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "refund_request" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "action_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "freeze_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "blacklist_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "mint_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "burn_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TABLE "refund_request" ALTER COLUMN "status" TYPE "ActionStatus_new" USING ("status"::text::"ActionStatus_new");
ALTER TYPE "ActionStatus" RENAME TO "ActionStatus_old";
ALTER TYPE "ActionStatus_new" RENAME TO "ActionStatus";
DROP TYPE "ActionStatus_old";
ALTER TABLE "action_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "blacklist_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "burn_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "freeze_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "mint_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "refund_request" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "config" DROP COLUMN "noOfApproval",
ADD COLUMN     "maxNoOfApproval" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "mintNoOfApproval" INTEGER NOT NULL DEFAULT 2;
