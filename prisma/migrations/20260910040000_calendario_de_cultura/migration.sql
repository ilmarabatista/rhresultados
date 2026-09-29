-- CreateTable
CREATE TABLE "CultureProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "startTime" TEXT NOT NULL DEFAULT '08:00',
    "endTime" TEXT DEFAULT '09:00',
    "location" TEXT,
    "companyServiceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CultureProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureProgramMonth" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "value" TEXT,
    "objective" TEXT,
    "actions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "CultureProgramMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureProgramWeek" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "theme" TEXT NOT NULL,
    "script" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "campaign" TEXT,
    "value" TEXT,
    "visitId" TEXT,

    CONSTRAINT "CultureProgramWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CultureProgram_companyId_idx" ON "CultureProgram"("companyId");

-- CreateIndex
CREATE INDEX "CultureProgramMonth_programId_year_month_idx" ON "CultureProgramMonth"("programId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "CultureProgramWeek_visitId_key" ON "CultureProgramWeek"("visitId");

-- CreateIndex
CREATE INDEX "CultureProgramWeek_programId_date_idx" ON "CultureProgramWeek"("programId", "date");

-- AddForeignKey
ALTER TABLE "CultureProgram" ADD CONSTRAINT "CultureProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureProgram" ADD CONSTRAINT "CultureProgram_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "CompanyService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureProgram" ADD CONSTRAINT "CultureProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureProgramMonth" ADD CONSTRAINT "CultureProgramMonth_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CultureProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureProgramWeek" ADD CONSTRAINT "CultureProgramWeek_programId_fkey" FOREIGN KEY ("programId") REFERENCES "CultureProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureProgramWeek" ADD CONSTRAINT "CultureProgramWeek_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

