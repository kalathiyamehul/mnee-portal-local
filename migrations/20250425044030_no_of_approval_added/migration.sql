-- AlterTable
ALTER TABLE "blacklist_request" ADD COLUMN     "no_of_approvals" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "freeze_request" ADD COLUMN     "no_of_approvals" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "mint_request" ALTER COLUMN "no_of_approvals" SET DEFAULT 2;
