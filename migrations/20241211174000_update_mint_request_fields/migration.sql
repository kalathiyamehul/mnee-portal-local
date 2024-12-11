-- Remove latestMinterTx from mint_request table
ALTER TABLE "mint_request" DROP COLUMN "latest_minter_tx";