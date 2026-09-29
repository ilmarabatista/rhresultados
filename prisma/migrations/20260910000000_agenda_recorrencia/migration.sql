-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "frequencia" TEXT,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "VisitTopic" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VisitTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitTopic_visitId_idx" ON "VisitTopic"("visitId");

-- CreateIndex
CREATE INDEX "Visit_seriesId_idx" ON "Visit"("seriesId");

-- AddForeignKey
ALTER TABLE "VisitTopic" ADD CONSTRAINT "VisitTopic_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

