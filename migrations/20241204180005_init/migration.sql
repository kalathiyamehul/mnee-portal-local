-- CreateEnum
CREATE TYPE "BlacklistAction" AS ENUM ('BLACKLIST', 'UNBLACKLIST');

-- CreateEnum
CREATE TYPE "FreezeRequestAction" AS ENUM ('FREEZE', 'UNFREEZE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'DONE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "id_address" TEXT,
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_request" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freeze_request" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "FreezeRequestAction" NOT NULL,
    "requested_by" TEXT NOT NULL,
    "callback_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "freeze_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_request" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "action" "BlacklistAction" NOT NULL,
    "requested_by" TEXT NOT NULL,
    "callback_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "blacklist_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mint_request" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "latest_minter_tx" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mint_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_approval" (
    "id" TEXT NOT NULL,
    "action_request_id" TEXT,
    "mint_request_id" TEXT,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "freeze_approval" (
    "id" TEXT NOT NULL,
    "freeze_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "freeze_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_approval" (
    "id" TEXT NOT NULL,
    "blacklist_request_id" TEXT NOT NULL,
    "approved_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklist_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fees" JSONB NOT NULL,
    "fee_address" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "latest_minter_tx" TEXT NOT NULL,

    CONSTRAINT "config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- AddForeignKey
ALTER TABLE "action_request" ADD CONSTRAINT "action_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freeze_request" ADD CONSTRAINT "freeze_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_request" ADD CONSTRAINT "blacklist_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mint_request" ADD CONSTRAINT "mint_request_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_approval" ADD CONSTRAINT "action_approval_action_request_id_fkey" FOREIGN KEY ("action_request_id") REFERENCES "action_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_approval" ADD CONSTRAINT "action_approval_mint_request_id_fkey" FOREIGN KEY ("mint_request_id") REFERENCES "mint_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_approval" ADD CONSTRAINT "action_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freeze_approval" ADD CONSTRAINT "freeze_approval_freeze_request_id_fkey" FOREIGN KEY ("freeze_request_id") REFERENCES "freeze_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "freeze_approval" ADD CONSTRAINT "freeze_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_blacklist_request_id_fkey" FOREIGN KEY ("blacklist_request_id") REFERENCES "blacklist_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_approval" ADD CONSTRAINT "blacklist_approval_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
