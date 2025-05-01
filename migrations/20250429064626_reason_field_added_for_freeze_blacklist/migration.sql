-- AlterTable
ALTER TABLE "blacklist_request" ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "freeze_request" ADD COLUMN     "reason" TEXT NOT NULL DEFAULT '';
