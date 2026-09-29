/*
  Warnings:

  - You are about to drop the column `rejectedStage` on the `Candidate` table. All the data in the column will be lost.
  - You are about to drop the column `stage` on the `Candidate` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "EtapaTipo" AS ENUM ('TRIAGEM', 'FICHA', 'TESTE', 'ENTREVISTA', 'LIVRE', 'DECISAO');

-- CreateEnum
CREATE TYPE "MovimentoResultado" AS ENUM ('ENTROU', 'APROVADO', 'REPROVADO', 'DESISTIU');

-- DropIndex
DROP INDEX "Candidate_jobOpeningId_stage_idx";

-- AlterTable
ALTER TABLE "Candidate" DROP COLUMN "rejectedStage",
DROP COLUMN "stage",
ADD COLUMN     "avisadoEm" TIMESTAMP(3),
ADD COLUMN     "cobradoEm" TIMESTAMP(3),
ADD COLUMN     "etapaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "etapaId" TEXT;

-- DropEnum
DROP TYPE "CandidateStage";

-- CreateTable
CREATE TABLE "ProcessoModelo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessoModelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaDoModelo" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "EtapaTipo" NOT NULL DEFAULT 'LIVRE',
    "prazoDias" INTEGER,

    CONSTRAINT "EtapaDoModelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtapaDaVaga" (
    "id" TEXT NOT NULL,
    "vagaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "tipo" "EtapaTipo" NOT NULL DEFAULT 'LIVRE',
    "prazoDias" INTEGER,

    CONSTRAINT "EtapaDaVaga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoDoCandidato" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "etapaNome" TEXT NOT NULL,
    "etapaId" TEXT,
    "resultado" "MovimentoResultado" NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criadoPorId" TEXT,

    CONSTRAINT "MovimentoDoCandidato_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EtapaDoModelo_modeloId_idx" ON "EtapaDoModelo"("modeloId");

-- CreateIndex
CREATE INDEX "EtapaDaVaga_vagaId_idx" ON "EtapaDaVaga"("vagaId");

-- CreateIndex
CREATE INDEX "MovimentoDoCandidato_candidateId_criadoEm_idx" ON "MovimentoDoCandidato"("candidateId", "criadoEm");

-- CreateIndex
CREATE INDEX "Candidate_jobOpeningId_etapaId_idx" ON "Candidate"("jobOpeningId", "etapaId");

-- AddForeignKey
ALTER TABLE "EtapaDoModelo" ADD CONSTRAINT "EtapaDoModelo_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "ProcessoModelo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaDaVaga" ADD CONSTRAINT "EtapaDaVaga_vagaId_fkey" FOREIGN KEY ("vagaId") REFERENCES "JobOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoDoCandidato" ADD CONSTRAINT "MovimentoDoCandidato_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_etapaId_fkey" FOREIGN KEY ("etapaId") REFERENCES "EtapaDaVaga"("id") ON DELETE SET NULL ON UPDATE CASCADE;
