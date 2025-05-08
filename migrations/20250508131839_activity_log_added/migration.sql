-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "action" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);
