-- CreateTable
CREATE TABLE "identity_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthPlace" TEXT,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "ktpOriginalFileName" TEXT,
    "ktpStoredFileName" TEXT,
    "ktpStoragePath" TEXT,
    "ktpMimeType" TEXT,
    "ktpSizeBytes" INTEGER,
    "ktpUploadedAt" TIMESTAMP(3),
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identity_change_requests_userId_status_idx" ON "identity_change_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "identity_change_requests_reviewedById_idx" ON "identity_change_requests"("reviewedById");

-- AddForeignKey
ALTER TABLE "identity_change_requests" ADD CONSTRAINT "identity_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_change_requests" ADD CONSTRAINT "identity_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
