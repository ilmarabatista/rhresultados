-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "cargoId" TEXT;

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treinamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'TECNICO',
    "cargaHoraria" DECIMAL(6,2),
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreinamentoDoCargo" (
    "treinamentoId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,

    CONSTRAINT "TreinamentoDoCargo_pkey" PRIMARY KEY ("treinamentoId","cargoId")
);

-- CreateTable
CREATE TABLE "TurmaDeTreinamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "treinamentoId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "mesPrevisto" TIMESTAMP(3),
    "instrutor" TEXT,
    "modalidade" TEXT NOT NULL DEFAULT 'INTERNO',
    "horas" DECIMAL(6,2),
    "investimento" DECIMAL(12,2),
    "material" TEXT,
    "justificativa" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TurmaDeTreinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDoModeloDeIntegracao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ItemDoModeloDeIntegracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaDeIntegracao" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "feito" BOOLEAN NOT NULL DEFAULT false,
    "feitoEm" TIMESTAMP(3),

    CONSTRAINT "EtapaDeIntegracao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_companyId_nome_key" ON "Cargo"("companyId", "nome");

-- CreateIndex
CREATE INDEX "Treinamento_companyId_idx" ON "Treinamento"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TurmaDeTreinamento_meetingId_key" ON "TurmaDeTreinamento"("meetingId");

-- CreateIndex
CREATE INDEX "TurmaDeTreinamento_companyId_idx" ON "TurmaDeTreinamento"("companyId");

-- CreateIndex
CREATE INDEX "TurmaDeTreinamento_treinamentoId_idx" ON "TurmaDeTreinamento"("treinamentoId");

-- CreateIndex
CREATE INDEX "ItemDoModeloDeIntegracao_companyId_idx" ON "ItemDoModeloDeIntegracao"("companyId");

-- CreateIndex
CREATE INDEX "EtapaDeIntegracao_employeeId_idx" ON "EtapaDeIntegracao"("employeeId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treinamento" ADD CONSTRAINT "Treinamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinamentoDoCargo" ADD CONSTRAINT "TreinamentoDoCargo_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreinamentoDoCargo" ADD CONSTRAINT "TreinamentoDoCargo_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeTreinamento" ADD CONSTRAINT "TurmaDeTreinamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeTreinamento" ADD CONSTRAINT "TurmaDeTreinamento_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamento"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurmaDeTreinamento" ADD CONSTRAINT "TurmaDeTreinamento_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDoModeloDeIntegracao" ADD CONSTRAINT "ItemDoModeloDeIntegracao_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaDeIntegracao" ADD CONSTRAINT "EtapaDeIntegracao_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Os cargos já digitados na equipe viram a lista inicial de cargos de cada
-- empresa, e cada pessoa fica ligada ao seu.
INSERT INTO "Cargo" ("id", "companyId", "nome")
SELECT 'cg' || md5(e."companyId" || ':' || btrim(e."role")), e."companyId", btrim(e."role")
FROM "Employee" e
WHERE e."role" IS NOT NULL AND btrim(e."role") <> ''
GROUP BY e."companyId", btrim(e."role");

UPDATE "Employee" e
SET "cargoId" = c."id", "role" = c."nome"
FROM "Cargo" c
WHERE c."companyId" = e."companyId" AND c."nome" = btrim(e."role");
