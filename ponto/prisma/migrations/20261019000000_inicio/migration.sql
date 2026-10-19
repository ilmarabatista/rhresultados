-- CreateEnum
CREATE TYPE "RegimePonto" AS ENUM ('BANCO_DE_HORAS', 'HORAS_EXTRAS');

-- CreateEnum
CREATE TYPE "OrigemMarcacao" AS ENUM ('APLICATIVO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('FERIADO', 'FOLGA', 'FERIAS', 'ABONO', 'ATESTADO');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "rhCompanyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "regime" "RegimePonto" NOT NULL DEFAULT 'BANCO_DE_HORAS',
    "horario" JSONB NOT NULL DEFAULT '[[],[[480,720],[780,1020]],[[480,720],[780,1020]],[[480,720],[780,1020]],[[480,720],[780,1020]],[[480,720],[780,1020]],[]]',
    "tolerancia" INTEGER NOT NULL DEFAULT 10,
    "intervaloMinimo" INTEGER NOT NULL DEFAULT 60,
    "validadeBancoMeses" INTEGER NOT NULL DEFAULT 6,
    "inicio" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "trocarSenha" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "horario" JSONB,
    "admissao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marcacao" (
    "id" TEXT NOT NULL,
    "nsr" SERIAL NOT NULL,
    "empresaId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "momento" TIMESTAMP(3) NOT NULL,
    "origem" "OrigemMarcacao" NOT NULL DEFAULT 'APLICATIVO',
    "motivo" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "precisao" DOUBLE PRECISION,
    "ip" TEXT,
    "anuladaEm" TIMESTAMP(3),
    "anuladaMotivo" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marcacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoMarcacao" (
    "marcacaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'image/jpeg',
    "dados" BYTEA NOT NULL,

    CONSTRAINT "FotoMarcacao_pkey" PRIMARY KEY ("marcacaoId")
);

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "colaboradorId" TEXT,
    "dia" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoOcorrencia" NOT NULL,
    "descricao" TEXT,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "dia" TIMESTAMP(3) NOT NULL,
    "minutos" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "mes" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cienteEm" TIMESTAMP(3),

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaLogin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT,
    "sucesso" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rhCompanyId_key" ON "Empresa"("rhCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Colaborador_email_key" ON "Colaborador"("email");

-- CreateIndex
CREATE INDEX "Colaborador_empresaId_idx" ON "Colaborador"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Marcacao_nsr_key" ON "Marcacao"("nsr");

-- CreateIndex
CREATE INDEX "Marcacao_colaboradorId_dia_idx" ON "Marcacao"("colaboradorId", "dia");

-- CreateIndex
CREATE INDEX "Marcacao_empresaId_dia_idx" ON "Marcacao"("empresaId", "dia");

-- CreateIndex
CREATE INDEX "Ocorrencia_empresaId_dia_idx" ON "Ocorrencia"("empresaId", "dia");

-- CreateIndex
CREATE INDEX "Lancamento_colaboradorId_dia_idx" ON "Lancamento"("colaboradorId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "Relatorio_colaboradorId_mes_key" ON "Relatorio"("colaboradorId", "mes");

-- CreateIndex
CREATE INDEX "TentativaLogin_email_createdAt_idx" ON "TentativaLogin"("email", "createdAt");

-- CreateIndex
CREATE INDEX "TentativaLogin_ip_createdAt_idx" ON "TentativaLogin"("ip", "createdAt");

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Marcacao" ADD CONSTRAINT "Marcacao_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoMarcacao" ADD CONSTRAINT "FotoMarcacao_marcacaoId_fkey" FOREIGN KEY ("marcacaoId") REFERENCES "Marcacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
