-- CreateEnum
CREATE TYPE "ProgramKind" AS ENUM ('CULTURA', 'ENDOMARKETING');

-- AlterTable
ALTER TABLE "CultureProgram" ADD COLUMN     "kind" "ProgramKind" NOT NULL DEFAULT 'CULTURA';

-- AlterTable
ALTER TABLE "CultureProgramMonth" ADD COLUMN     "channel" TEXT,
ADD COLUMN     "done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owner" TEXT;

