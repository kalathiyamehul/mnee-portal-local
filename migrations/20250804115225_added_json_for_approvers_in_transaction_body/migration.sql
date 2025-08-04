/*
  Warnings:

  - Added the required column `approvers` to the `transactionRecords` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "transactionRecords" ADD COLUMN     "approvers" JSONB NOT NULL;
