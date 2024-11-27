-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fees" JSONB NOT NULL,
    "feeAddress" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);
