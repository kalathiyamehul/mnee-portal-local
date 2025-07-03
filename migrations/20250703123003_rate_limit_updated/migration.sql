/*
  Warnings:

  - Changed the type of `type` on the `rate_limit_attempt` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "rate_limit_attempt" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- DropEnum
DROP TYPE "RateLimitType";

-- CreateIndex
CREATE INDEX "rate_limit_attempt_identifier_type_window_start_idx" ON "rate_limit_attempt"("identifier", "type", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_attempt_identifier_type_key" ON "rate_limit_attempt"("identifier", "type");
