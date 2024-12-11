-- Create index on action_request table for action, status, and created_at
CREATE INDEX "action_request_action_status_created_at_idx" ON "action_request" ("action", "status", "created_at"); 