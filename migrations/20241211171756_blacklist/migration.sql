-- AlterTable
ALTER TABLE "blacklist" RENAME CONSTRAINT "blacklist_request_pkey" TO "blacklist_pkey";

-- RenameForeignKey
ALTER TABLE "blacklist" RENAME CONSTRAINT "blacklist_request_requested_by_fkey" TO "blacklist_requested_by_fkey";
