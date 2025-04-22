-- CreateTable
CREATE TABLE "refund_request" (
    "id" TEXT NOT NULL,
    "outpoint" TEXT NOT NULL,
    "refund_address" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "txid" TEXT NOT NULL DEFAULT '',
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refund_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refund_approval" (
    "id" TEXT NOT NULL,
    "refund_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refund_approval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refund_request_outpoint_status_created_at_idx" ON "refund_request"("outpoint", "status", "created_at");

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_approval" ADD CONSTRAINT "refund_approval_refund_request_id_fkey" FOREIGN KEY ("refund_request_id") REFERENCES "refund_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_approval" ADD CONSTRAINT "refund_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE; 