-- Add mint_address and fund_address to config table
ALTER TABLE "config" ADD COLUMN "mint_address" TEXT;
ALTER TABLE "config" ADD COLUMN "fund_address" TEXT; 