-- AlterTable
ALTER TABLE "Cargo" ADD COLUMN     "missao" TEXT,
ADD COLUMN     "requisitos" TEXT,
ADD COLUMN     "responsabilidades" TEXT;

-- AlterTable
ALTER TABLE "DevelopmentAction" ADD COLUMN     "metaId" TEXT,
ADD COLUMN     "responsavel" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'PRATICA',
ADD COLUMN     "treinamentoId" TEXT;

-- AlterTable
ALTER TABLE "DevelopmentPlan" ADD COLUMN     "avaliacaoId" TEXT,
ADD COLUMN     "balanco" TEXT,
ADD COLUMN     "proximaConversa" TIMESTAMP(3),
ADD COLUMN     "visitId" TEXT;

-- CreateTable
CREATE TABLE "MetaDoPdi" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "notaId" TEXT,
    "competencia" TEXT,
    "titulo" TEXT NOT NULL,
    "indicador" TEXT,
    "recursos" TEXT,
    "relevancia" TEXT,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'NAO_INICIADA',
    "progresso" INTEGER NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaDoPdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaDoPdi" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "resumo" TEXT NOT NULL,
    "combinados" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversaDoPdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressoDaMeta" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "metaId" TEXT NOT NULL,
    "progresso" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "comentario" TEXT,

    CONSTRAINT "ProgressoDaMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenciaDoCargo" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TECNICA',
    "descricao" TEXT,
    "nivelEsperado" INTEGER NOT NULL DEFAULT 3,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetenciaDoCargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoDeCompetencias" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cargoId" TEXT,
    "cargoNome" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "pontosFortes" TEXT,
    "querDesenvolver" TEXT,
    "apoio" TEXT,
    "carreira" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvaliacaoDeCompetencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaDeCompetencia" (
    "id" TEXT NOT NULL,
    "avaliacaoId" TEXT NOT NULL,
    "competenciaId" TEXT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TECNICA',
    "esperado" INTEGER NOT NULL,
    "pessoa" INTEGER,
    "avaliador" INTEGER,
    "acordado" INTEGER,
    "comentario" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NotaDeCompetencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetaDoPdi_planId_idx" ON "MetaDoPdi"("planId");

-- CreateIndex
CREATE INDEX "ConversaDoPdi_planId_data_idx" ON "ConversaDoPdi"("planId", "data");

-- CreateIndex
CREATE INDEX "ProgressoDaMeta_metaId_idx" ON "ProgressoDaMeta"("metaId");

-- CreateIndex
CREATE INDEX "CompetenciaDoCargo_cargoId_idx" ON "CompetenciaDoCargo"("cargoId");

-- CreateIndex
CREATE INDEX "AvaliacaoDeCompetencias_employeeId_data_idx" ON "AvaliacaoDeCompetencias"("employeeId", "data");

-- CreateIndex
CREATE INDEX "NotaDeCompetencia_avaliacaoId_idx" ON "NotaDeCompetencia"("avaliacaoId");

-- CreateIndex
CREATE INDEX "DevelopmentAction_metaId_idx" ON "DevelopmentAction"("metaId");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentPlan_visitId_key" ON "DevelopmentPlan"("visitId");

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "AvaliacaoDeCompetencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentPlan" ADD CONSTRAINT "DevelopmentPlan_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDoPdi" ADD CONSTRAINT "MetaDoPdi_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaDoPdi" ADD CONSTRAINT "MetaDoPdi_notaId_fkey" FOREIGN KEY ("notaId") REFERENCES "NotaDeCompetencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentAction" ADD CONSTRAINT "DevelopmentAction_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "MetaDoPdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentAction" ADD CONSTRAINT "DevelopmentAction_treinamentoId_fkey" FOREIGN KEY ("treinamentoId") REFERENCES "Treinamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaDoPdi" ADD CONSTRAINT "ConversaDoPdi_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DevelopmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaDoPdi" ADD CONSTRAINT "ConversaDoPdi_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoDaMeta" ADD CONSTRAINT "ProgressoDaMeta_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaDoPdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressoDaMeta" ADD CONSTRAINT "ProgressoDaMeta_metaId_fkey" FOREIGN KEY ("metaId") REFERENCES "MetaDoPdi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetenciaDoCargo" ADD CONSTRAINT "CompetenciaDoCargo_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDeCompetencias" ADD CONSTRAINT "AvaliacaoDeCompetencias_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDeCompetencias" ADD CONSTRAINT "AvaliacaoDeCompetencias_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoDeCompetencias" ADD CONSTRAINT "AvaliacaoDeCompetencias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaDeCompetencia" ADD CONSTRAINT "NotaDeCompetencia_avaliacaoId_fkey" FOREIGN KEY ("avaliacaoId") REFERENCES "AvaliacaoDeCompetencias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaDeCompetencia" ADD CONSTRAINT "NotaDeCompetencia_competenciaId_fkey" FOREIGN KEY ("competenciaId") REFERENCES "CompetenciaDoCargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

