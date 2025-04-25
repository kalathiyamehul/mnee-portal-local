/*
  Warnings:

  - You are about to drop the `blacklist` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "blacklist" DROP CONSTRAINT "blacklist_requested_by_fkey";

-- DropForeignKey
ALTER TABLE "blacklist_approval" DROP CONSTRAINT "blacklist_approval_approved_by_fkey";

-- DropForeignKey
ALTER TABLE "blacklist_approval" DROP CONSTRAINT "blacklist_approval_blacklist_request_id_fkey";

-- DropIndex
DROP INDEX "blacklist_approval_approved_by_idx";

-- DropIndex
DROP INDEX "blacklist_approval_blacklist_request_id_idx";

-- AlterTable
ALTER TABLE "mint_request" ADD COLUMN     "no_of_approvals" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "blacklist";

-- AddForeignKey
ALTER TABLE "blacklist_request" ADD CONSTRAINT "blacklist_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_blacklist_request_id_fkey" FOREIGN KEY ("blacklist_request_id") REFERENCES "blacklist_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
