CREATE TYPE "RevokeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "document_revoke_requests" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RevokeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_revoke_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_revoke_request_evidences" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_revoke_request_evidences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "document_revoke_requests_documentId_status_idx" ON "document_revoke_requests"("documentId", "status");
CREATE INDEX "document_revoke_requests_requesterId_status_idx" ON "document_revoke_requests"("requesterId", "status");
CREATE INDEX "document_revoke_requests_reviewedById_idx" ON "document_revoke_requests"("reviewedById");
CREATE INDEX "document_revoke_request_evidences_requestId_idx" ON "document_revoke_request_evidences"("requestId");

ALTER TABLE "document_revoke_requests" ADD CONSTRAINT "document_revoke_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_revoke_requests" ADD CONSTRAINT "document_revoke_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_revoke_requests" ADD CONSTRAINT "document_revoke_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_revoke_request_evidences" ADD CONSTRAINT "document_revoke_request_evidences_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "document_revoke_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
