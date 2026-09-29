-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "visitId" TEXT;

-- CreateIndex
CREATE INDEX "Task_visitId_idx" ON "Task"("visitId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

