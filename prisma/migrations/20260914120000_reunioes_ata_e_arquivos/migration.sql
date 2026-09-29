-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "agenda" TEXT,
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "level" TEXT NOT NULL DEFAULT 'SETOR',
ADD COLUMN     "location" TEXT,
ADD COLUMN     "number" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startTime" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'AGENDADA',
ADD COLUMN     "visitId" TEXT,
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "transcript" DROP NOT NULL;

-- As reuniões que já existiam foram registradas depois de acontecer: ficam
-- realizadas, numeradas por empresa na ordem em que aconteceram.
UPDATE "Meeting" SET "status" = 'REALIZADA';

UPDATE "Meeting" AS m
SET "number" = n.numero
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "date", "createdAt") AS numero
  FROM "Meeting"
) AS n
WHERE m."id" = n."id";

-- CreateTable
CREATE TABLE "MeetingItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT,
    "validFrom" TIMESTAMP(3),
    "responsible" TEXT,
    "dueDate" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,

    CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureWeekFile" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CultureWeekFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingItem_meetingId_idx" ON "MeetingItem"("meetingId");

-- CreateIndex
CREATE INDEX "MeetingItem_kind_done_dueDate_idx" ON "MeetingItem"("kind", "done", "dueDate");

-- CreateIndex
CREATE INDEX "MeetingParticipant_meetingId_idx" ON "MeetingParticipant"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "CultureWeekFile_weekId_kind_key" ON "CultureWeekFile"("weekId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_visitId_key" ON "Meeting"("visitId");

-- AddForeignKey
ALTER TABLE "MeetingItem" ADD CONSTRAINT "MeetingItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingParticipant" ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureWeekFile" ADD CONSTRAINT "CultureWeekFile_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CultureProgramWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;
