-- AlterTable
ALTER TABLE "config" ADD COLUMN "latest_minter_tx" TEXT NOT NULL DEFAULT '';

-- RemoveDefault
ALTER TABLE "config" ALTER COLUMN "latest_minter_tx" DROP DEFAULT; 