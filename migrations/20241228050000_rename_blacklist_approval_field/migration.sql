-- Create blacklist_approval table with correct names from the start
CREATE TABLE "blacklist_request" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "BlacklistAction" NOT NULL,
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "blacklist_request_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blacklist_approval" (
    "id" TEXT NOT NULL,
    "blacklist_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_approval_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_blacklist_request_id_fkey" FOREIGN KEY ("blacklist_request_id") REFERENCES "blacklist_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX "blacklist_approval_blacklist_request_id_idx" ON "blacklist_approval"("blacklist_request_id");
CREATE INDEX "blacklist_approval_approved_by_idx" ON "blacklist_approval"("approved_by");
CREATE INDEX "blacklist_request_address_status_created_at_idx" ON "blacklist_request"("address", "status", "created_at"); 