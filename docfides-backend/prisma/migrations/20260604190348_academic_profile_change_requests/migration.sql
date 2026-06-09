-- CreateTable
CREATE TABLE "academic_profile_change_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nim" TEXT NOT NULL,
    "prodiId" TEXT NOT NULL,
    "angkatan" INTEGER,
    "kelas" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_profile_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "academic_profile_change_requests_userId_status_idx" ON "academic_profile_change_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "academic_profile_change_requests_prodiId_idx" ON "academic_profile_change_requests"("prodiId");

-- CreateIndex
CREATE INDEX "academic_profile_change_requests_reviewedById_idx" ON "academic_profile_change_requests"("reviewedById");

-- AddForeignKey
ALTER TABLE "academic_profile_change_requests" ADD CONSTRAINT "academic_profile_change_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_profile_change_requests" ADD CONSTRAINT "academic_profile_change_requests_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "academic_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_profile_change_requests" ADD CONSTRAINT "academic_profile_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
