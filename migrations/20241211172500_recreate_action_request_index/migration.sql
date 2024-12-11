-- Recreate the dropped index on action_request table
CREATE INDEX IF NOT EXISTS "action_request_action_status_created_at_idx" ON "action_request" ("action", "status", "created_at"); 