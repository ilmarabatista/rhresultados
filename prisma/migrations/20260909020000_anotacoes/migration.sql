-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('NOVA', 'PROCESSADA', 'DESCARTADA');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "noteId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "captureToken" TEXT;

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NoteStatus" NOT NULL DEFAULT 'NOVA',
    "source" TEXT NOT NULL DEFAULT 'SISTEMA',
    "createdById" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Note_status_createdAt_idx" ON "Note"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_noteId_idx" ON "Task"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "User_captureToken_key" ON "User"("captureToken");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

