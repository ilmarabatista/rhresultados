-- AlterTable
ALTER TABLE "CompanyService" ADD COLUMN     "team" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "teamOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

