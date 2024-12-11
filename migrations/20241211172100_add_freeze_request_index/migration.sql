-- Create index on freeze_request table for address, status, and created_at
CREATE INDEX "freeze_request_address_status_created_at_idx" ON "freeze_request" ("address", "status", "created_at"); 