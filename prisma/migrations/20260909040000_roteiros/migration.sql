-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('RASCUNHO', 'APROVADO', 'GRAVADO', 'PUBLICADO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "ScriptFramework" AS ENUM ('PASTOR', 'HVC');

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "tema" TEXT NOT NULL,
    "publico" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "plataforma" TEXT,
    "duracaoSegundos" INTEGER NOT NULL DEFAULT 30,
    "tom" TEXT,
    "oferta" TEXT,
    "provaSocial" TEXT,
    "objecoes" TEXT,
    "cta" TEXT,
    "restricoes" TEXT,
    "framework" "ScriptFramework" NOT NULL,
    "copyThesis" TEXT NOT NULL,
    "dsi" TEXT NOT NULL,
    "blocos" JSONB NOT NULL,
    "blocosOriginais" JSONB NOT NULL,
    "ganchosAlternativos" JSONB NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'RASCUNHO',
    "descartadoPorque" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptEdit" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "bloco" TEXT NOT NULL,
    "antes" TEXT NOT NULL,
    "depois" TEXT NOT NULL,
    "usarComoExemplo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Script_status_createdAt_idx" ON "Script"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScriptEdit_scriptId_idx" ON "ScriptEdit"("scriptId");

-- CreateIndex
CREATE INDEX "ScriptEdit_usarComoExemplo_createdAt_idx" ON "ScriptEdit"("usarComoExemplo", "createdAt");

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptEdit" ADD CONSTRAINT "ScriptEdit_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

