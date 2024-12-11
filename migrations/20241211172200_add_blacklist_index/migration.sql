-- Create index on blacklist table for address, status, and created_at
CREATE INDEX "blacklist_address_status_created_at_idx" ON "blacklist" ("address", "status", "created_at"); 