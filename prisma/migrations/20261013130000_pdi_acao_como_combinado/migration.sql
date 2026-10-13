-- AlterTable
ALTER TABLE "DevelopmentAction" ADD COLUMN     "observacao" TEXT,
ADD COLUMN     "quantoFeito" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "DevelopmentAction_done_dueDate_idx" ON "DevelopmentAction"("done", "dueDate");


-- O que já estava marcado como feito conta 100%.
UPDATE "DevelopmentAction" SET "quantoFeito" = 100 WHERE "done" = true;
