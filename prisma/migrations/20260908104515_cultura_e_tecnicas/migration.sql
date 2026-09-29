-- AlterTable
ALTER TABLE "DevelopmentPlan" ADD COLUMN     "assessmentId" TEXT;

-- CreateTable
CREATE TABLE "CultureDiagnosis" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mission" TEXT,
    "vision" TEXT,
    "values" TEXT,
    "expectedBehaviors" TEXT,
    "futureObjectives" TEXT,
    "leadership" TEXT,
    "strengths" TEXT,
    "fragilities" TEXT,
    "behaviorsToEvolve" TEXT,
    "teamChallenges" TEXT,
    "other" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CultureDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureCalendar" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "journey" TEXT NOT NULL,
    "centralMessage" TEXT NOT NULL,
    "transformations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CultureCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CultureCalendarMonth" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "theme" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "strategicFocus" TEXT NOT NULL,

    CONSTRAINT "CultureCalendarMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAssessment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleTasks" TEXT,
    "strengths" TEXT,
    "difficulties" TEXT,
    "toolsAndSystems" TEXT,
    "blockers" TEXT,
    "wantsToDevelop" TEXT,
    "supportNeeded" TEXT,
    "other" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CultureDiagnosis_companyId_key" ON "CultureDiagnosis"("companyId");

-- CreateIndex
CREATE INDEX "CultureCalendar_companyId_year_idx" ON "CultureCalendar"("companyId", "year");

-- CreateIndex
CREATE INDEX "CultureCalendarMonth_calendarId_idx" ON "CultureCalendarMonth"("calendarId");

-- CreateIndex
CREATE INDEX "SkillAssessment_employeeId_idx" ON "SkillAssessment"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentPlan_assessmentId_key" ON "DevelopmentPlan"("assessmentId");

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SkillAssessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureDiagnosis" ADD CONSTRAINT "CultureDiagnosis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureCalendar" ADD CONSTRAINT "CultureCalendar_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CultureCalendarMonth" ADD CONSTRAINT "CultureCalendarMonth_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "CultureCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAssessment" ADD CONSTRAINT "SkillAssessment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

