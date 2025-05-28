/*
  Warnings:

  - You are about to drop the column `updated_at` on the `activity_log` table. All the data in the column will be lost.
  - Made the column `name` on table `activity_log` required. This step will fail if there are existing NULL values in that column.
  - Made the column `action` on table `activity_log` required. This step will fail if there are existing NULL values in that column.
  - Made the column `description` on table `activity_log` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RateLimitType" AS ENUM ('LOGIN_ATTEMPT', 'API_REQUEST', 'PASSWORD_RESET', 'TWO_FA_ATTEMPT');

-- AlterTable
ALTER TABLE "activity_log" DROP COLUMN "updated_at",
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "action" SET NOT NULL,
ALTER COLUMN "description" SET NOT NULL;

-- CreateTable
CREATE TABLE "rate_limit_attempt" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "type" "RateLimitType" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "window_start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_attempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_lockout" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_lockout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_attempt_identifier_type_window_start_idx" ON "rate_limit_attempt"("identifier", "type", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_attempt_identifier_type_key" ON "rate_limit_attempt"("identifier", "type");

-- CreateIndex
CREATE UNIQUE INDEX "account_lockout_email_key" ON "account_lockout"("email");

-- CreateIndex
CREATE INDEX "account_lockout_email_locked_until_idx" ON "account_lockout"("email", "locked_until");
