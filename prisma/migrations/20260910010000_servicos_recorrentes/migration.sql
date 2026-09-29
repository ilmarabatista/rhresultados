-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "defaultAgenda" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "recurring" BOOLEAN NOT NULL DEFAULT false;

