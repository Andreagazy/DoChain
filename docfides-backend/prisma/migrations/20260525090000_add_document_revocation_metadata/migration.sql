ALTER TABLE "documents"
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT;

CREATE INDEX "documents_revokedById_idx" ON "documents"("revokedById");

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
