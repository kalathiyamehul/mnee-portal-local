/*
  Warnings:

  - You are about to drop the column `mintNoOfApproval` on the `config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "config" DROP COLUMN "mintNoOfApproval",
ADD COLUMN     "minNoOfApproval" INTEGER NOT NULL DEFAULT 2;
