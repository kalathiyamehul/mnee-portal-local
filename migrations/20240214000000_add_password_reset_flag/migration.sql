-- Add requires_password_reset field to User table with default true for new users
ALTER TABLE "user" ADD COLUMN "requires_password_reset" BOOLEAN NOT NULL DEFAULT true; 