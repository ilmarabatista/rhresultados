-- Revisão geral de 2026-09-29.
--
-- Saem as tabelas dos módulos que já não tinham tela desde 19/09 (etapas de
-- serviço e escopo contratado, planos e calendários de cultura antigos,
-- recrutamento antigo, admissão, análise de cargo, anotações, NPS). O backup
-- completo de todas as tabelas está em
-- rhresultados-backup\antes-revisao-geral-2026-09-29\banco-json.
--
-- A agenda passa a apontar para o produto do catálogo (Visit.serviceId), como
-- a reunião e o plano já faziam; o produto antigo de cada compromisso e de cada
-- reunião é trazido do escopo contratado antes de ele sair.
-- O teste mandado pela Seleção passa a lembrar de qual candidato é.

-- Dados: o produto do catálogo no lugar do produto contratado.
ALTER TABLE "Visit" ADD COLUMN "serviceId" TEXT;

UPDATE "Visit" v
SET "serviceId" = cs."serviceId"
FROM "CompanyService" cs
WHERE v."companyServiceId" = cs."id" AND cs."serviceId" IS NOT NULL;

UPDATE "Meeting" m
SET "serviceId" = cs."serviceId"
FROM "CompanyService" cs
WHERE m."serviceId" IS NULL AND m."companyServiceId" = cs."id" AND cs."serviceId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_examId_fkey";

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_integrationVisitId_fkey";

-- DropForeignKey
ALTER TABLE "Admission" DROP CONSTRAINT "Admission_jobOpeningId_fkey";

-- DropForeignKey
ALTER TABLE "AdmissionDocument" DROP CONSTRAINT "AdmissionDocument_admissionId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateFile" DROP CONSTRAINT "CandidateFile_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateTest" DROP CONSTRAINT "CandidateTest_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateTest" DROP CONSTRAINT "CandidateTest_customTestId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateTest" DROP CONSTRAINT "CandidateTest_templateId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyService" DROP CONSTRAINT "CompanyService_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyService" DROP CONSTRAINT "CompanyService_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "CultureCalendar" DROP CONSTRAINT "CultureCalendar_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CultureCalendarMonth" DROP CONSTRAINT "CultureCalendarMonth_calendarId_fkey";

-- DropForeignKey
ALTER TABLE "CultureDiagnosis" DROP CONSTRAINT "CultureDiagnosis_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgram" DROP CONSTRAINT "CultureProgram_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgram" DROP CONSTRAINT "CultureProgram_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgram" DROP CONSTRAINT "CultureProgram_createdById_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgramMonth" DROP CONSTRAINT "CultureProgramMonth_programId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgramMonth" DROP CONSTRAINT "CultureProgramMonth_visitId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgramWeek" DROP CONSTRAINT "CultureProgramWeek_programId_fkey";

-- DropForeignKey
ALTER TABLE "CultureProgramWeek" DROP CONSTRAINT "CultureProgramWeek_visitId_fkey";

-- DropForeignKey
ALTER TABLE "CultureWeekFile" DROP CONSTRAINT "CultureWeekFile_weekId_fkey";

-- DropForeignKey
ALTER TABLE "DeliveryCycle" DROP CONSTRAINT "DeliveryCycle_companyId_fkey";

-- DropForeignKey
ALTER TABLE "DeliveryCycle" DROP CONSTRAINT "DeliveryCycle_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_jobOpeningId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_visitId_fkey";

-- DropForeignKey
ALTER TABLE "InterviewGuide" DROP CONSTRAINT "InterviewGuide_companyId_fkey";

-- DropForeignKey
ALTER TABLE "InterviewGuide" DROP CONSTRAINT "InterviewGuide_positionId_fkey";

-- DropForeignKey
ALTER TABLE "JobAnalysis" DROP CONSTRAINT "JobAnalysis_companyId_fkey";

-- DropForeignKey
ALTER TABLE "JobAnalysis" DROP CONSTRAINT "JobAnalysis_createdById_fkey";

-- DropForeignKey
ALTER TABLE "JobAnalysis" DROP CONSTRAINT "JobAnalysis_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "JobDescription" DROP CONSTRAINT "JobDescription_analysisId_fkey";

-- DropForeignKey
ALTER TABLE "JobOpening" DROP CONSTRAINT "JobOpening_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "JobOpening" DROP CONSTRAINT "JobOpening_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "JobOpening" DROP CONSTRAINT "JobOpening_positionId_fkey";

-- DropForeignKey
ALTER TABLE "JobPlanFile" DROP CONSTRAINT "JobPlanFile_companyId_fkey";

-- DropForeignKey
ALTER TABLE "JobPosition" DROP CONSTRAINT "JobPosition_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_weekId_fkey";

-- DropForeignKey
ALTER TABLE "Note" DROP CONSTRAINT "Note_createdById_fkey";

-- DropForeignKey
ALTER TABLE "NpsRound" DROP CONSTRAINT "NpsRound_companyId_fkey";

-- DropForeignKey
ALTER TABLE "NpsRound" DROP CONSTRAINT "NpsRound_createdById_fkey";

-- DropForeignKey
ALTER TABLE "NpsRound" DROP CONSTRAINT "NpsRound_visitId_fkey";

-- DropForeignKey
ALTER TABLE "PlannedMeeting" DROP CONSTRAINT "PlannedMeeting_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "PlannedMeeting" DROP CONSTRAINT "PlannedMeeting_programId_fkey";

-- DropForeignKey
ALTER TABLE "PlannedMeeting" DROP CONSTRAINT "PlannedMeeting_weekId_fkey";

-- DropForeignKey
ALTER TABLE "ServiceStep" DROP CONSTRAINT "ServiceStep_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_cycleId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_meetingId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_noteId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_visitId_fkey";

-- DropForeignKey
ALTER TABLE "TestTemplate" DROP CONSTRAINT "TestTemplate_positionId_fkey";

-- DropForeignKey
ALTER TABLE "Visit" DROP CONSTRAINT "Visit_companyServiceId_fkey";

-- DropForeignKey
ALTER TABLE "_NoteCompanies" DROP CONSTRAINT "_NoteCompanies_A_fkey";

-- DropForeignKey
ALTER TABLE "_NoteCompanies" DROP CONSTRAINT "_NoteCompanies_B_fkey";

-- DropIndex
DROP INDEX "JobOpening_cycleId_key";

-- DropIndex
DROP INDEX "Meeting_weekId_key";

-- DropIndex
DROP INDEX "User_captureToken_key";

-- AlterTable
ALTER TABLE "Candidate" ALTER COLUMN "source" SET DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "recruitmentEmails";

-- AlterTable
ALTER TABLE "JobOpening" DROP COLUMN "companyServiceId",
DROP COLUMN "cycleId",
DROP COLUMN "positionId",
DROP COLUMN "subjectKeywords";

-- AlterTable
ALTER TABLE "Meeting" DROP COLUMN "companyServiceId",
DROP COLUMN "level",
DROP COLUMN "summary",
DROP COLUMN "transcript",
DROP COLUMN "weekId";

-- AlterTable
ALTER TABLE "Service" DROP COLUMN "actionName",
DROP COLUMN "cycleName",
DROP COLUMN "defaultAgenda",
DROP COLUMN "modelo",
DROP COLUMN "recurring",
DROP COLUMN "teamOptions";

-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "recruitmentEmail",
DROP COLUMN "recruitmentEmailSecret";

-- AlterTable
ALTER TABLE "TesteEnviado" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "captureToken";

-- AlterTable
ALTER TABLE "Visit" DROP COLUMN "companyServiceId";

-- DropTable
DROP TABLE "Admission";

-- DropTable
DROP TABLE "AdmissionDocument";

-- DropTable
DROP TABLE "CandidateFile";

-- DropTable
DROP TABLE "CandidateTest";

-- DropTable
DROP TABLE "CompanyService";

-- DropTable
DROP TABLE "CultureCalendar";

-- DropTable
DROP TABLE "CultureCalendarMonth";

-- DropTable
DROP TABLE "CultureDiagnosis";

-- DropTable
DROP TABLE "CultureProgram";

-- DropTable
DROP TABLE "CultureProgramMonth";

-- DropTable
DROP TABLE "CultureProgramWeek";

-- DropTable
DROP TABLE "CultureWeekFile";

-- DropTable
DROP TABLE "DeliveryCycle";

-- DropTable
DROP TABLE "Interview";

-- DropTable
DROP TABLE "InterviewGuide";

-- DropTable
DROP TABLE "JobAnalysis";

-- DropTable
DROP TABLE "JobDescription";

-- DropTable
DROP TABLE "JobPlanFile";

-- DropTable
DROP TABLE "JobPosition";

-- DropTable
DROP TABLE "MailboxSync";

-- DropTable
DROP TABLE "Note";

-- DropTable
DROP TABLE "NpsRound";

-- DropTable
DROP TABLE "PlannedMeeting";

-- DropTable
DROP TABLE "ServiceStep";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "TestTemplate";

-- DropTable
DROP TABLE "_NoteCompanies";

-- DropEnum
DROP TYPE "AdmissionStage";

-- DropEnum
DROP TYPE "ExecucaoModelo";

-- DropEnum
DROP TYPE "JobAnalysisStatus";

-- DropEnum
DROP TYPE "JobKind";

-- DropEnum
DROP TYPE "NoteStatus";

-- DropEnum
DROP TYPE "ProgramKind";

-- DropEnum
DROP TYPE "ServiceStatus";

-- DropEnum
DROP TYPE "TestKind";

-- DropEnum
DROP TYPE "TestStatus";

-- CreateIndex
CREATE INDEX "TesteEnviado_candidateId_idx" ON "TesteEnviado"("candidateId");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesteEnviado" ADD CONSTRAINT "TesteEnviado_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
