-- AlterEnum
ALTER TYPE "TestKind" ADD VALUE 'TECNICO';
ALTER TYPE "TestKind" ADD VALUE 'SITUACIONAL';

-- AlterTable
ALTER TABLE "CandidateTest" ADD COLUMN     "questions" JSONB,
ADD COLUMN     "templateId" TEXT;

-- AlterTable (não havia entrevista gravada quando a coluna mudou de formato)
ALTER TABLE "Interview" DROP COLUMN "questions",
ADD COLUMN     "items" JSONB;

-- AlterTable (não havia roteiro gravado quando a coluna mudou de formato)
ALTER TABLE "InterviewGuide" DROP COLUMN "questions",
ADD COLUMN     "items" JSONB,
ADD COLUMN     "positionId" TEXT;

-- AlterTable
ALTER TABLE "JobOpening" ADD COLUMN     "positionId" TEXT;

-- CreateTable
CREATE TABLE "JobPosition" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "area" TEXT,
    "mission" TEXT,
    "technicalSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "behavioralSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requirements" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPlanFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPlanFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestTemplate" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "kind" "TestKind" NOT NULL,
    "questions" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobPosition_companyId_title_key" ON "JobPosition"("companyId", "title");

-- CreateIndex
CREATE INDEX "JobPlanFile_companyId_idx" ON "JobPlanFile"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TestTemplate_positionId_kind_key" ON "TestTemplate"("positionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewGuide_positionId_key" ON "InterviewGuide"("positionId");

-- AddForeignKey
ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewGuide" ADD CONSTRAINT "InterviewGuide_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTest" ADD CONSTRAINT "CandidateTest_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TestTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosition" ADD CONSTRAINT "JobPosition_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPlanFile" ADD CONSTRAINT "JobPlanFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestTemplate" ADD CONSTRAINT "TestTemplate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
