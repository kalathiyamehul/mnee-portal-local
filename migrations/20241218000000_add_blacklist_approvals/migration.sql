-- Create blacklist_approval table
CREATE TABLE "blacklist_approval" (
    "id" TEXT NOT NULL,
    "blacklist_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_approval_pkey" PRIMARY KEY ("id")
);

-- Add requires_approval column to blacklist table
ALTER TABLE "blacklist" ADD COLUMN "requires_approval" BOOLEAN NOT NULL DEFAULT true;

-- Change default status to PENDING for blacklist table
ALTER TABLE "blacklist" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- Add foreign key constraints
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_blacklist_id_fkey" FOREIGN KEY ("blacklist_id") REFERENCES "blacklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX "blacklist_approval_blacklist_id_idx" ON "blacklist_approval"("blacklist_id");
CREATE INDEX "blacklist_approval_approved_by_idx" ON "blacklist_approval"("approved_by"); 