-- Drop existing tables and types
DROP TABLE IF EXISTS "FreezeRequest" CASCADE;
DROP TABLE IF EXISTS "BlacklistRequest" CASCADE;
DROP TABLE IF EXISTS "BlacklistApproval" CASCADE;
DROP TABLE IF EXISTS "FreezeApproval" CASCADE;
DROP TYPE IF EXISTS "FreezeAction" CASCADE;
DROP TYPE IF EXISTS "BlacklistAction" CASCADE;
DROP TYPE IF EXISTS "FreezeRequestAction" CASCADE;

-- Create new types
CREATE TYPE "BlacklistAction" AS ENUM ('BLACKLIST', 'UNBLACKLIST');
CREATE TYPE "FreezeRequestAction" AS ENUM ('FREEZE', 'UNFREEZE');

-- Create new tables
CREATE TABLE "BlacklistRequest" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "BlacklistAction" NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlacklistRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FreezeRequest" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "FreezeRequestAction" NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "callbackUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FreezeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlacklistApproval" (
    "id" TEXT NOT NULL,
    "blacklistRequestId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlacklistApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FreezeApproval" (
    "id" TEXT NOT NULL,
    "freezeRequestId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FreezeApproval_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "BlacklistRequest" ADD CONSTRAINT "BlacklistRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FreezeRequest" ADD CONSTRAINT "FreezeRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BlacklistApproval" ADD CONSTRAINT "BlacklistApproval_blacklistRequestId_fkey" FOREIGN KEY ("blacklistRequestId") REFERENCES "BlacklistRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BlacklistApproval" ADD CONSTRAINT "BlacklistApproval_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FreezeApproval" ADD CONSTRAINT "FreezeApproval_freezeRequestId_fkey" FOREIGN KEY ("freezeRequestId") REFERENCES "FreezeRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FreezeApproval" ADD CONSTRAINT "FreezeApproval_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 