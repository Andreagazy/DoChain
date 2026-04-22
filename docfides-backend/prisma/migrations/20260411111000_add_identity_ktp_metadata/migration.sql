-- AlterTable
ALTER TABLE "identities"
ADD COLUMN "ktpOriginalFileName" TEXT,
ADD COLUMN "ktpStoredFileName" TEXT,
ADD COLUMN "ktpStoragePath" TEXT,
ADD COLUMN "ktpMimeType" TEXT,
ADD COLUMN "ktpSizeBytes" INTEGER,
ADD COLUMN "ktpUploadedAt" TIMESTAMP(3);
