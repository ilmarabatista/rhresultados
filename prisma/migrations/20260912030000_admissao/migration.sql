-- CreateEnum
CREATE TYPE "AdmissionStage" AS ENUM ('DOCUMENTOS', 'ASO', 'CONTABILIDADE', 'INTEGRACAO', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobOpeningId" TEXT,
    "stage" "AdmissionStage" NOT NULL DEFAULT 'DOCUMENTOS',
    "token" TEXT NOT NULL,
    "data" JSONB,
    "linkSentAt" TIMESTAMP(3),
    "dataSubmittedAt" TIMESTAMP(3),
    "jobTitle" TEXT,
    "startDate" TIMESTAMP(3),
    "examId" TEXT,
    "packageDownloadedAt" TIMESTAMP(3),
    "sentToAccountingAt" TIMESTAMP(3),
    "integrationVisitId" TEXT,
    "integrationChecklist" JSONB,
    "employeeId" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admission_candidateId_key" ON "Admission"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_token_key" ON "Admission"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_examId_key" ON "Admission"("examId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_integrationVisitId_key" ON "Admission"("integrationVisitId");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_employeeId_key" ON "Admission"("employeeId");

-- CreateIndex
CREATE INDEX "Admission_companyId_stage_idx" ON "Admission"("companyId", "stage");

-- CreateIndex
CREATE INDEX "AdmissionDocument_admissionId_kind_idx" ON "AdmissionDocument"("admissionId", "kind");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_examId_fkey" FOREIGN KEY ("examId") REFERENCES "HealthExam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_integrationVisitId_fkey" FOREIGN KEY ("integrationVisitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
