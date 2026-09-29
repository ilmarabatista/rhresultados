-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "ordemNoPlano" INTEGER,
ADD COLUMN     "planoId" TEXT;

-- CreateTable
CREATE TABLE "PlanoDeTreinamento" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceId" TEXT,
    "titulo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "periodicidade" TEXT NOT NULL DEFAULT 'MENSAL',
    "horario" TEXT,
    "inicio" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanoDeTreinamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesteEnviado" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "customTestId" TEXT,
    "estrutura" JSONB,
    "nomeDoTeste" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "telefone" TEXT,
    "companyId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "respostas" JSONB,
    "resultado" JSONB,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),

    CONSTRAINT "TesteEnviado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanoDeTreinamento_companyId_idx" ON "PlanoDeTreinamento"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TesteEnviado_token_key" ON "TesteEnviado"("token");

-- CreateIndex
CREATE INDEX "TesteEnviado_enviadoEm_idx" ON "TesteEnviado"("enviadoEm");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoDeTreinamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoDeTreinamento" ADD CONSTRAINT "PlanoDeTreinamento_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanoDeTreinamento" ADD CONSTRAINT "PlanoDeTreinamento_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesteEnviado" ADD CONSTRAINT "TesteEnviado_customTestId_fkey" FOREIGN KEY ("customTestId") REFERENCES "CustomTest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesteEnviado" ADD CONSTRAINT "TesteEnviado_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

