-- Add txid column to mint_request table
ALTER TABLE "mint_request" ADD COLUMN "txid" TEXT NOT NULL DEFAULT ''; 