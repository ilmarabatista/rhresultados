-- AlterEnum
ALTER TYPE "TestKind" ADD VALUE 'PERSONALIZADO';

-- AlterTable
ALTER TABLE "CandidateTest" ADD COLUMN     "customTestId" TEXT;

-- AlterTable
ALTER TABLE "CultureProgramWeek" ADD COLUMN     "material" JSONB,
ADD COLUMN     "materialAt" TIMESTAMP(3),
ADD COLUMN     "materialEditedAt" TIMESTAMP(3),
ADD COLUMN     "materialError" TEXT,
ADD COLUMN     "materialStatus" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "recruitmentEmail" TEXT,
ADD COLUMN     "recruitmentEmailSecret" TEXT;

-- CreateTable
CREATE TABLE "CustomTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ESCOLHA',
    "factors" JSONB NOT NULL,
    "pairs" JSONB,
    "questions" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomTest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CandidateTest" ADD CONSTRAINT "CandidateTest_customTestId_fkey" FOREIGN KEY ("customTestId") REFERENCES "CustomTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
