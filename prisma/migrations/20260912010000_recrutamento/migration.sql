-- CreateEnum
CREATE TYPE "JobOpeningStatus" AS ENUM ('ABERTA', 'PAUSADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "CandidateStage" AS ENUM ('TRIAGEM', 'FICHA', 'TESTES', 'ENTREVISTA', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "CandidateOutcome" AS ENUM ('EM_ANDAMENTO', 'APROVADO', 'REPROVADO', 'DESISTIU');

-- CreateEnum
CREATE TYPE "TestKind" AS ENUM ('DISC');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('ENVIADO', 'RESPONDIDO');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "recruitmentEmails" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "JobOpening" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyServiceId" TEXT,
    "cycleId" TEXT,
    "title" TEXT NOT NULL,
    "subjectKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "JobOpeningStatus" NOT NULL DEFAULT 'ABERTA',
    "notes" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewGuide" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "jobOpeningId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'EMAIL',
    "stage" "CandidateStage" NOT NULL DEFAULT 'TRIAGEM',
    "outcome" "CandidateOutcome" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "stageNotes" JSONB,
    "rejectedStage" "CandidateStage",
    "finalNotes" TEXT,
    "resumeText" TEXT,
    "emailMessageId" TEXT,
    "emailFrom" TEXT,
    "emailTo" TEXT,
    "emailSubject" TEXT,
    "receivedAt" TIMESTAMP(3),
    "applicationToken" TEXT NOT NULL,
    "applicationAnswers" JSONB,
    "applicationSentAt" TIMESTAMP(3),
    "applicationAnsweredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateFile" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateTest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "kind" "TestKind" NOT NULL DEFAULT 'DISC',
    "token" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'ENVIADO',
    "answers" JSONB,
    "result" JSONB,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "CandidateTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "jobOpeningId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "location" TEXT,
    "visitId" TEXT,
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "transcript" TEXT,
    "answers" JSONB,
    "analysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailboxSync" (
    "id" TEXT NOT NULL,
    "uidValidity" BIGINT,
    "lastUid" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "MailboxSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobOpening_cycleId_key" ON "JobOpening"("cycleId");

-- CreateIndex
CREATE INDEX "JobOpening_companyId_status_idx" ON "JobOpening"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewGuide_companyId_jobTitle_key" ON "InterviewGuide"("companyId", "jobTitle");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_emailMessageId_key" ON "Candidate"("emailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_applicationToken_key" ON "Candidate"("applicationToken");

-- CreateIndex
CREATE INDEX "Candidate_companyId_jobOpeningId_idx" ON "Candidate"("companyId", "jobOpeningId");

-- CreateIndex
CREATE INDEX "Candidate_jobOpeningId_stage_idx" ON "Candidate"("jobOpeningId", "stage");

-- CreateIndex
CREATE INDEX "CandidateFile_candidateId_idx" ON "CandidateFile"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateTest_token_key" ON "CandidateTest"("token");

-- CreateIndex
CREATE INDEX "CandidateTest_candidateId_idx" ON "CandidateTest"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_visitId_key" ON "Interview"("visitId");

-- CreateIndex
CREATE INDEX "Interview_candidateId_idx" ON "Interview"("candidateId");

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "CompanyService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "DeliveryCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewGuide" ADD CONSTRAINT "InterviewGuide_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateFile" ADD CONSTRAINT "CandidateFile_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTest" ADD CONSTRAINT "CandidateTest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobOpeningId_fkey" FOREIGN KEY ("jobOpeningId") REFERENCES "JobOpening"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------ dados

-- Os ciclos que já existem no recrutamento e seleção viram vagas, com o
-- mesmo nome e a mesma situação.
INSERT INTO "JobOpening" ("id", "companyId", "companyServiceId", "cycleId", "title", "status", "notes", "openedAt", "closedAt", "createdAt", "updatedAt")
SELECT 'vaga-' || c."id",
       c."companyId",
       c."companyServiceId",
       c."id",
       c."title",
       CASE WHEN c."closedAt" IS NULL THEN 'ABERTA'::"JobOpeningStatus" ELSE 'ENCERRADA'::"JobOpeningStatus" END,
       c."notes",
       c."openedAt",
       c."closedAt",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "DeliveryCycle" c
JOIN "CompanyService" cs ON cs."id" = c."companyServiceId"
JOIN "Service" s ON s."id" = cs."serviceId"
WHERE s."slug" = 'recrutamento-selecao';

-- O recrutamento conta cada vaga como um ciclo.
UPDATE "Service" SET "cycleName" = 'vaga' WHERE "slug" = 'recrutamento-selecao';
UPDATE "CompanyService" cs SET "cycleName" = 'vaga'
FROM "Service" s
WHERE cs."serviceId" = s."id" AND s."slug" = 'recrutamento-selecao';
