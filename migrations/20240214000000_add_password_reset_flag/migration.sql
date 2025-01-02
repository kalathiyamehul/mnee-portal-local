-- Add requires_password_reset field to User table
ALTER TABLE "user" ADD COLUMN "requires_password_reset" BOOLEAN NOT NULL DEFAULT false; 