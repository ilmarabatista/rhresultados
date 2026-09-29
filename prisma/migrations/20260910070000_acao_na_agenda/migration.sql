-- AlterTable
ALTER TABLE "CultureProgramMonth" ADD COLUMN     "visitId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CultureProgramMonth_visitId_key" ON "CultureProgramMonth"("visitId");

-- AddForeignKey
ALTER TABLE "CultureProgramMonth" ADD CONSTRAINT "CultureProgramMonth_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

