-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('ADMISSIONAL', 'PERIODICO', 'RETORNO_AO_TRABALHO', 'MUDANCA_DE_FUNCAO', 'DEMISSIONAL');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('A_AGENDAR', 'AGENDADO', 'REALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ExamResult" AS ENUM ('APTO', 'APTO_COM_RESTRICAO', 'INAPTO');

-- CreateTable
CREATE TABLE "HealthExam" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "candidateName" TEXT,
    "jobTitle" TEXT,
    "kind" "ExamKind" NOT NULL DEFAULT 'ADMISSIONAL',
    "status" "ExamStatus" NOT NULL DEFAULT 'A_AGENDAR',
    "dueDate" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "scheduledTime" TEXT,
    "clinic" TEXT,
    "clinicPhone" TEXT,
    "performedAt" TIMESTAMP(3),
    "result" "ExamResult",
    "restrictions" TEXT,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthExam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthExam_companyId_status_idx" ON "HealthExam"("companyId", "status");

-- CreateIndex
CREATE INDEX "HealthExam_employeeId_idx" ON "HealthExam"("employeeId");

-- CreateIndex
CREATE INDEX "HealthExam_dueDate_idx" ON "HealthExam"("dueDate");

-- AddForeignKey
ALTER TABLE "HealthExam" ADD CONSTRAINT "HealthExam_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthExam" ADD CONSTRAINT "HealthExam_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthExam" ADD CONSTRAINT "HealthExam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

