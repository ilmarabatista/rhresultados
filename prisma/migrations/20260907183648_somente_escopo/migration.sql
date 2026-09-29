-- DropForeignKey
ALTER TABLE "Goal" DROP CONSTRAINT "Goal_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Plan" DROP CONSTRAINT "Plan_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Subtask" DROP CONSTRAINT "Subtask_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_planId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropIndex
DROP INDEX "Task_companyId_scheduledDate_idx";

-- DropIndex
DROP INDEX "Task_planId_idx";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "category",
DROP COLUMN "completionDays",
DROP COLUMN "dueDate",
DROP COLUMN "planId",
DROP COLUMN "priority",
DROP COLUMN "projectId",
DROP COLUMN "recurrenceDays",
DROP COLUMN "scheduledDate",
DROP COLUMN "status",
ALTER COLUMN "companyServiceId" SET NOT NULL;

-- DropTable
DROP TABLE "Goal";

-- DropTable
DROP TABLE "Plan";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "Subtask";

-- DropEnum
DROP TYPE "GoalKind";

-- DropEnum
DROP TYPE "PlanStatus";

-- DropEnum
DROP TYPE "Priority";

-- DropEnum
DROP TYPE "ProjectStatus";

-- DropEnum
DROP TYPE "TaskStatus";

-- CreateIndex
CREATE INDEX "Task_companyId_idx" ON "Task"("companyId");

