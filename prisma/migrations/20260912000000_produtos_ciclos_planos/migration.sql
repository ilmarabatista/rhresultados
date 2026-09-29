-- CreateEnum
CREATE TYPE "ExecucaoModelo" AS ENUM ('ETAPAS', 'ENCONTROS', 'MENSAL');

-- AlterTable
ALTER TABLE "CompanyService" ADD COLUMN     "actionName" TEXT NOT NULL DEFAULT 'etapa',
ADD COLUMN     "cycleName" TEXT NOT NULL DEFAULT 'ciclo',
ADD COLUMN     "modelo" "ExecucaoModelo" NOT NULL DEFAULT 'ETAPAS',
ADD COLUMN     "whatWeDo" TEXT;

-- AlterTable
ALTER TABLE "CultureProgram" ADD COLUMN     "frequencia" TEXT NOT NULL DEFAULT 'SEMANAL';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "actionName" TEXT NOT NULL DEFAULT 'etapa',
ADD COLUMN     "cycleName" TEXT NOT NULL DEFAULT 'ciclo',
ADD COLUMN     "modelo" "ExecucaoModelo" NOT NULL DEFAULT 'ETAPAS';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "cycleId" TEXT;

-- CreateTable
CREATE TABLE "DeliveryCycle" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyServiceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryCycle_companyServiceId_idx" ON "DeliveryCycle"("companyServiceId");

-- CreateIndex
CREATE INDEX "Task_cycleId_idx" ON "Task"("cycleId");

-- AddForeignKey
ALTER TABLE "DeliveryCycle" ADD CONSTRAINT "DeliveryCycle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCycle" ADD CONSTRAINT "DeliveryCycle_companyServiceId_fkey" FOREIGN KEY ("companyServiceId") REFERENCES "CompanyService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "DeliveryCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ------------------------------------------------------------------ dados

-- Como cada produto do catálogo é executado, e como se chamam as ações e os
-- ciclos dele.
UPDATE "Service" SET "cycleName" = 'diagnóstico' WHERE "slug" = 'diagnostico-geral';
UPDATE "Service" SET "cycleName" = 'rodada' WHERE "slug" = 'avaliacao-desempenho';
UPDATE "Service" SET "cycleName" = 'turma' WHERE "slug" = 'treinamento';
UPDATE "Service" SET "cycleName" = 'vaga' WHERE "slug" = 'recrutamento-selecao';
UPDATE "Service" SET "cycleName" = 'pesquisa' WHERE "slug" = 'analise-clima';
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'reunião' WHERE "slug" = 'fortalecimento-cultura';
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'encontro' WHERE "slug" IN ('desenvolvimento-tecnico-setor', 'microrreuniao-desenvolvimento-tecnico');
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'aula' WHERE "slug" = 'habilidades-comunicacao';
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'rodada' WHERE "slug" = 'reuniao-de-nps';
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'conversa' WHERE "slug" = 'ciclo-feedback';
UPDATE "Service" SET "modelo" = 'ENCONTROS', "actionName" = 'leitura' WHERE "slug" = 'indicadores-resultados';
UPDATE "Service" SET "modelo" = 'MENSAL', "actionName" = 'ação' WHERE "slug" = 'endomarketing';
UPDATE "Service" SET "modelo" = 'MENSAL', "actionName" = 'celebração' WHERE "slug" = 'celebracoes';

-- A microrreunião de desenvolvimento técnico foi juntada ao desenvolvimento
-- técnico por setor, que tem um plano por setor. A entrega que ainda não tinha
-- nada feito sai quando a empresa já tem o desenvolvimento técnico; a que tem
-- histórico passa a ser dele.
DELETE FROM "CompanyService" m
USING "Service" sm
WHERE m."serviceId" = sm."id"
  AND sm."slug" = 'microrreuniao-desenvolvimento-tecnico'
  AND EXISTS (
    SELECT 1 FROM "CompanyService" d JOIN "Service" sd ON d."serviceId" = sd."id"
    WHERE sd."slug" = 'desenvolvimento-tecnico-setor' AND d."companyId" = m."companyId"
  )
  AND NOT EXISTS (SELECT 1 FROM "Task" t WHERE t."companyServiceId" = m."id" AND t."done")
  AND NOT EXISTS (SELECT 1 FROM "Visit" v WHERE v."companyServiceId" = m."id");

UPDATE "CompanyService" m
SET "serviceId" = sd."id", "name" = sd."name", "team" = NULL
FROM "Service" sm, "Service" sd
WHERE m."serviceId" = sm."id"
  AND sm."slug" = 'microrreuniao-desenvolvimento-tecnico'
  AND sd."slug" = 'desenvolvimento-tecnico-setor';

UPDATE "Service" SET "active" = false WHERE "slug" = 'microrreuniao-desenvolvimento-tecnico';

-- Cada entrega leva o modelo do produto e o texto do que fazemos pela empresa.
UPDATE "CompanyService" cs
SET "modelo" = s."modelo",
    "actionName" = s."actionName",
    "cycleName" = s."cycleName",
    "whatWeDo" = COALESCE(cs."whatWeDo", s."description")
FROM "Service" s
WHERE cs."serviceId" = s."id";

-- Os calendários que moravam em abas próprias passam a pertencer à entrega do
-- produto correspondente.
UPDATE "CultureProgram" p
SET "companyServiceId" = (
  SELECT cs."id"
  FROM "CompanyService" cs JOIN "Service" s ON cs."serviceId" = s."id"
  WHERE cs."companyId" = p."companyId"
    AND s."slug" = CASE p."kind"
      WHEN 'CULTURA' THEN 'fortalecimento-cultura'
      WHEN 'ENDOMARKETING' THEN 'endomarketing'
      ELSE 'desenvolvimento-tecnico-setor'
    END
  ORDER BY cs."order"
  LIMIT 1
)
WHERE p."companyServiceId" IS NULL;

UPDATE "CultureProgram" SET "frequencia" = 'MENSAL' WHERE "kind" = 'ENDOMARKETING';

-- Os compromissos dos calendários, das rodadas de NPS e dos aniversários
-- passam a apontar para a entrega: é o que os leva para a Evolução com o nome
-- do produto.
UPDATE "Visit" v
SET "companyServiceId" = p."companyServiceId"
FROM "CultureProgramWeek" w JOIN "CultureProgram" p ON w."programId" = p."id"
WHERE w."visitId" = v."id" AND v."companyServiceId" IS NULL AND p."companyServiceId" IS NOT NULL;

UPDATE "Visit" v
SET "companyServiceId" = p."companyServiceId"
FROM "CultureProgramMonth" m JOIN "CultureProgram" p ON m."programId" = p."id"
WHERE m."visitId" = v."id" AND v."companyServiceId" IS NULL AND p."companyServiceId" IS NOT NULL;

UPDATE "Visit" v
SET "companyServiceId" = cs."id"
FROM "NpsRound" r, "CompanyService" cs, "Service" s
WHERE r."visitId" = v."id"
  AND cs."companyId" = v."companyId" AND cs."serviceId" = s."id" AND s."slug" = 'reuniao-de-nps'
  AND v."companyServiceId" IS NULL;

UPDATE "Visit" v
SET "companyServiceId" = cs."id"
FROM "CompanyService" cs, "Service" s
WHERE v."subject" LIKE 'Aniversário de %'
  AND cs."companyId" = v."companyId" AND cs."serviceId" = s."id" AND s."slug" = 'celebracoes'
  AND v."companyServiceId" IS NULL;

-- As etapas das entregas passo a passo entram no primeiro ciclo.
INSERT INTO "DeliveryCycle" ("id", "companyId", "companyServiceId", "title", "order", "openedAt", "closedAt", "createdAt", "updatedAt")
SELECT 'ciclo-' || cs."id",
       cs."companyId",
       cs."id",
       INITCAP(cs."cycleName") || ' 1',
       0,
       COALESCE(cs."startedAt", cs."createdAt"),
       CASE WHEN cs."status" = 'CONCLUIDO' THEN cs."finishedAt" END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "CompanyService" cs
WHERE cs."modelo" = 'ETAPAS'
  AND EXISTS (SELECT 1 FROM "Task" t WHERE t."companyServiceId" = cs."id");

UPDATE "Task" t
SET "cycleId" = 'ciclo-' || t."companyServiceId"
FROM "CompanyService" cs
WHERE t."companyServiceId" = cs."id" AND cs."modelo" = 'ETAPAS';
