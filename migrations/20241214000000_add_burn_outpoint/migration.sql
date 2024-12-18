-- Add outpoint column to burn_request table
ALTER TABLE "burn_request" ADD COLUMN "outpoint" TEXT;

-- Create index on outpoint for faster lookups
CREATE INDEX "burn_request_outpoint_idx" ON "burn_request"("outpoint");

-- Drop txid and vout columns since they'll be replaced by outpoint
ALTER TABLE "burn_request" DROP COLUMN IF EXISTS "txid";
ALTER TABLE "burn_request" DROP COLUMN IF EXISTS "vout"; 