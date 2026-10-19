-- O ponto virou um sistema à parte (pasta ponto/, schema "ponto"). Estas tabelas
-- ficam sem uso no RH.

-- DropForeignKey
ALTER TABLE "PontoConfig" DROP CONSTRAINT "PontoConfig_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PontoMarcacao" DROP CONSTRAINT "PontoMarcacao_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PontoMarcacao" DROP CONSTRAINT "PontoMarcacao_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PontoOcorrencia" DROP CONSTRAINT "PontoOcorrencia_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PontoOcorrencia" DROP CONSTRAINT "PontoOcorrencia_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PontoLancamento" DROP CONSTRAINT "PontoLancamento_companyId_fkey";

-- DropForeignKey
ALTER TABLE "PontoLancamento" DROP CONSTRAINT "PontoLancamento_employeeId_fkey";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "pontoJornada",
DROP COLUMN "pontoPin";

-- DropTable
DROP TABLE "PontoConfig";

-- DropTable
DROP TABLE "PontoMarcacao";

-- DropTable
DROP TABLE "PontoOcorrencia";

-- DropTable
DROP TABLE "PontoLancamento";

-- DropEnum
DROP TYPE "RegimePonto";

-- DropEnum
DROP TYPE "OrigemMarcacao";

-- DropEnum
DROP TYPE "TipoOcorrenciaPonto";


-- Travas do PIN do ponto antigo.
DELETE FROM "LoginAttempt" WHERE "email" LIKE 'ponto:%';
