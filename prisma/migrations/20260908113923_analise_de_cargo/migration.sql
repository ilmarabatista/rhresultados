-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('GERENCIAL', 'OPERACIONAL', 'TECNICO');

-- CreateEnum
CREATE TYPE "JobAnalysisStatus" AS ENUM ('AGUARDANDO', 'RESPONDIDO', 'DESCRITO');

-- CreateTable
CREATE TABLE "JobAnalysis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "kind" "JobKind" NOT NULL,
    "status" "JobAnalysisStatus" NOT NULL DEFAULT 'AGUARDANDO',
    "personName" TEXT,
    "jobTitle" TEXT NOT NULL,
    "department" TEXT,
    "managerTitle" TEXT,
    "subordinateTitles" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "answers" JSONB,
    "respondedAt" TIMESTAMP(3),
    "answerSource" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cbo" TEXT,
    "revision" TEXT NOT NULL DEFAULT 'Revisão 01',
    "department" TEXT,
    "managerTitle" TEXT,
    "subordinateTitles" TEXT,
    "mission" TEXT NOT NULL,
    "responsibilities" JSONB NOT NULL,
    "requirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobAnalysis_token_key" ON "JobAnalysis"("token");

-- CreateIndex
CREATE INDEX "JobAnalysis_companyId_status_idx" ON "JobAnalysis"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "JobDescription_analysisId_key" ON "JobDescription"("analysisId");

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAnalysis" ADD CONSTRAINT "JobAnalysis_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "JobAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

