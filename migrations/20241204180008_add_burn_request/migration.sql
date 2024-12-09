-- CreateTable
CREATE TABLE "burn_request" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "burn_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burn_approval" (
    "id" TEXT NOT NULL,
    "burn_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "burn_approval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "burn_request" ADD CONSTRAINT "burn_request_requested_by_fkey"
    FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burn_approval" ADD CONSTRAINT "burn_approval_burn_request_id_fkey"
    FOREIGN KEY ("burn_request_id") REFERENCES "burn_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "burn_approval" ADD CONSTRAINT "burn_approval_approved_by_fkey"
    FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE; 