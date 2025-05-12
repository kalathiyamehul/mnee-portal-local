-- CreateEnum
CREATE TYPE "CustomerRequestAction" AS ENUM ('CREATE', 'UPDATE');

-- CreateTable
CREATE TABLE "customer_request" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "CustomerRequestAction" NOT NULL,
    "requested_by" TEXT NOT NULL,
    "no_of_approvals" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "customer_id" TEXT,

    CONSTRAINT "customer_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_approval" (
    "id" TEXT NOT NULL,
    "customer_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_approval_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "customer_request" ADD CONSTRAINT "customer_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_request" ADD CONSTRAINT "customer_request_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_approval" ADD CONSTRAINT "customer_approval_customer_request_id_fkey" FOREIGN KEY ("customer_request_id") REFERENCES "customer_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_approval" ADD CONSTRAINT "customer_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
