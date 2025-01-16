-- Add requires_password_reset field to User table with default true for new users
DO $$ 
BEGIN 
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                 WHERE table_name='user' AND column_name='requires_password_reset') THEN
        ALTER TABLE "user" ADD COLUMN "requires_password_reset" BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$; 