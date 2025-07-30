-- AlterTable
ALTER TABLE "burn_request" ADD COLUMN     "ticket_id" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "mint_request" ADD COLUMN     "ticket_id" TEXT NOT NULL DEFAULT '';
