CREATE TYPE "AcademicUnitType" AS ENUM ('JURUSAN', 'PRODI');
CREATE TYPE "EmploymentType" AS ENUM ('DOSEN', 'TENAGA_KEPENDIDIKAN', 'ADMINISTRASI');
CREATE TYPE "StructuralPosition" AS ENUM ('KAJUR', 'KAPRODI', 'ADMIN_PRODI');

CREATE TABLE "academic_units" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "AcademicUnitType" NOT NULL,
  "parentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "academic_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nim" TEXT NOT NULL,
  "prodiId" TEXT NOT NULL,
  "angkatan" INTEGER,
  "kelas" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_profiles" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nip" TEXT,
  "nidn" TEXT,
  "employeeType" "EmploymentType" NOT NULL DEFAULT 'DOSEN',
  "homeUnitId" TEXT NOT NULL,
  "positionTitle" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "employee_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "structural_assignments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "academicUnitId" TEXT NOT NULL,
  "position" "StructuralPosition" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "structural_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "academic_units_code_key" ON "academic_units"("code");
CREATE INDEX "academic_units_type_idx" ON "academic_units"("type");
CREATE INDEX "academic_units_parentId_idx" ON "academic_units"("parentId");

CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");
CREATE UNIQUE INDEX "student_profiles_nim_key" ON "student_profiles"("nim");
CREATE INDEX "student_profiles_prodiId_idx" ON "student_profiles"("prodiId");

CREATE UNIQUE INDEX "employee_profiles_userId_key" ON "employee_profiles"("userId");
CREATE UNIQUE INDEX "employee_profiles_nip_key" ON "employee_profiles"("nip");
CREATE UNIQUE INDEX "employee_profiles_nidn_key" ON "employee_profiles"("nidn");
CREATE INDEX "employee_profiles_homeUnitId_idx" ON "employee_profiles"("homeUnitId");

CREATE UNIQUE INDEX "structural_assignments_userId_academicUnitId_position_key" ON "structural_assignments"("userId", "academicUnitId", "position");
CREATE INDEX "structural_assignments_academicUnitId_position_idx" ON "structural_assignments"("academicUnitId", "position");

ALTER TABLE "academic_units" ADD CONSTRAINT "academic_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "academic_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_prodiId_fkey" FOREIGN KEY ("prodiId") REFERENCES "academic_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_profiles" ADD CONSTRAINT "employee_profiles_homeUnitId_fkey" FOREIGN KEY ("homeUnitId") REFERENCES "academic_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "structural_assignments" ADD CONSTRAINT "structural_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "structural_assignments" ADD CONSTRAINT "structural_assignments_academicUnitId_fkey" FOREIGN KEY ("academicUnitId") REFERENCES "academic_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
