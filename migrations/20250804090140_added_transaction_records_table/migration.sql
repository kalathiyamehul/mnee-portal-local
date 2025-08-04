-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MINT', 'BURN', 'REFUND');

-- CreateTable
CREATE TABLE "transactionRecords" (
    "id" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "timestamp" TIMESTAMP(3),
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactionRecords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactionRecords_txid_key" ON "transactionRecords"("txid");

-- AddForeignKey
ALTER TABLE "transactionRecords" ADD CONSTRAINT "transactionRecords_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
