-- CreateEnum
CREATE TYPE "VisitKind" AS ENUM ('BRIEFING', 'ACOMPANHAMENTO', 'ENTREGA', 'OUTRO');

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'PROSPECTO';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "briefing" TEXT,
ADD COLUMN     "briefingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "kind" "VisitKind" NOT NULL DEFAULT 'ACOMPANHAMENTO';

