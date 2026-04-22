-- AlterTable
ALTER TABLE "email_verifications" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);
