-- CreateEnum
CREATE TYPE "RegimePonto" AS ENUM ('BANCO_DE_HORAS', 'HORAS_EXTRAS');

-- CreateEnum
CREATE TYPE "OrigemMarcacao" AS ENUM ('RELOGIO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoOcorrenciaPonto" AS ENUM ('FERIADO', 'FOLGA', 'FERIAS', 'ABONO', 'ATESTADO');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "pontoJornada" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "pontoPin" TEXT;

-- CreateTable
CREATE TABLE "PontoConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regime" "RegimePonto" NOT NULL DEFAULT 'BANCO_DE_HORAS',
    "jornada" INTEGER[] DEFAULT ARRAY[0, 480, 480, 480, 480, 480, 240]::INTEGER[],
    "tolerancia" INTEGER NOT NULL DEFAULT 10,
    "intervaloMinimo" INTEGER NOT NULL DEFAULT 60,
    "validadeBancoMeses" INTEGER NOT NULL DEFAULT 6,
    "inicio" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PontoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoMarcacao" (
    "id" TEXT NOT NULL,
    "nsr" SERIAL NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL,
    "origem" "OrigemMarcacao" NOT NULL DEFAULT 'RELOGIO',
    "motivo" TEXT,
    "ip" TEXT,
    "anuladaEm" TIMESTAMP(3),
    "anuladaMotivo" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoMarcacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoOcorrencia" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT,
    "dia" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoOcorrenciaPonto" NOT NULL,
    "descricao" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoOcorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PontoLancamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "minutos" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PontoLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PontoConfig_companyId_key" ON "PontoConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PontoConfig_token_key" ON "PontoConfig"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PontoMarcacao_nsr_key" ON "PontoMarcacao"("nsr");

-- CreateIndex
CREATE INDEX "PontoMarcacao_employeeId_dia_idx" ON "PontoMarcacao"("employeeId", "dia");

-- CreateIndex
CREATE INDEX "PontoMarcacao_companyId_dia_idx" ON "PontoMarcacao"("companyId", "dia");

-- CreateIndex
CREATE INDEX "PontoOcorrencia_companyId_dia_idx" ON "PontoOcorrencia"("companyId", "dia");

-- CreateIndex
CREATE INDEX "PontoLancamento_employeeId_dia_idx" ON "PontoLancamento"("employeeId", "dia");

-- AddForeignKey
ALTER TABLE "PontoConfig" ADD CONSTRAINT "PontoConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoMarcacao" ADD CONSTRAINT "PontoMarcacao_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoMarcacao" ADD CONSTRAINT "PontoMarcacao_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoOcorrencia" ADD CONSTRAINT "PontoOcorrencia_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoOcorrencia" ADD CONSTRAINT "PontoOcorrencia_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoLancamento" ADD CONSTRAINT "PontoLancamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PontoLancamento" ADD CONSTRAINT "PontoLancamento_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

