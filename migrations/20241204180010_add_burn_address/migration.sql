-- Add burn_address to config table
ALTER TABLE "config" ADD COLUMN "burn_address" TEXT NOT NULL DEFAULT ''; 