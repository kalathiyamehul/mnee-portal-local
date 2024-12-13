-- Drop callbackUrl from freeze_request table
ALTER TABLE freeze_request DROP COLUMN IF EXISTS callback_url;

-- Drop callbackUrl from blacklist table
ALTER TABLE blacklist DROP COLUMN IF EXISTS callback_url; 