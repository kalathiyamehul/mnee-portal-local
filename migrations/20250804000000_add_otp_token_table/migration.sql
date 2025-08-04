-- Create OTP token table for password reset functionality
CREATE TABLE IF NOT EXISTS "otp_token" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_token_pkey" PRIMARY KEY ("id")
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "otp_token_email_expires_at_idx" ON "otp_token"("email", "expires_at");
CREATE INDEX IF NOT EXISTS "otp_token_token_expires_at_idx" ON "otp_token"("token", "expires_at"); 