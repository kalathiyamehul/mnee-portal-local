/*
  Warnings:

  - You are about to drop the column `email` on the `customer` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `customer_request` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "customer_email_key";

-- AlterTable
ALTER TABLE "customer" DROP COLUMN "email",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "customer_request" DROP COLUMN "email";
