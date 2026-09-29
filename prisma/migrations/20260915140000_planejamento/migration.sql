-- CreateTable
CREATE TABLE "PlannedMeeting" (
    "id" TEXT NOT NULL,
    "companyServiceId" TEXT NOT NULL,
    "programId" TEXT,
    "theme" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "weekId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlannedMeeting_weekId_key" ON "PlannedMeeting"("weekId");

-- CreateIndex
CREATE INDEX "PlannedMeeting_companyServiceId_order_idx" ON "PlannedMeeting"("companyServiceId", "order");

-- AddForeignKey
ALTER TABLE "PlannedMeeting" ADD CONSTRAINT "PlannedMeeting_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "CompanyService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedMeeting" ADD CONSTRAINT "PlannedMeeting_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CultureProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedMeeting" ADD CONSTRAINT "PlannedMeeting_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CultureProgramWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;
