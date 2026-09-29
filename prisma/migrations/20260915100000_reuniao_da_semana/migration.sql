-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "weekId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_weekId_key" ON "Meeting"("weekId");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CultureProgramWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
