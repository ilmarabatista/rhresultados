-- PDI: autoavaliação por link. Modelos por função, com perguntas que a empresa
-- monta; o envio a cada pessoa; e o vínculo com a avaliação que sai dele.
-- Só acrescenta.

CREATE TABLE IF NOT EXISTS "ModeloDeAutoavaliacao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargoId" TEXT,
    "instrucoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModeloDeAutoavaliacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModeloDeAutoavaliacao_companyId_idx" ON "ModeloDeAutoavaliacao"("companyId");
CREATE INDEX IF NOT EXISTS "ModeloDeAutoavaliacao_cargoId_idx" ON "ModeloDeAutoavaliacao"("cargoId");

CREATE TABLE IF NOT EXISTS "PerguntaDeAutoavaliacao" (
    "id" TEXT NOT NULL,
    "modeloId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "destino" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PerguntaDeAutoavaliacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PerguntaDeAutoavaliacao_modeloId_idx" ON "PerguntaDeAutoavaliacao"("modeloId");

CREATE TABLE IF NOT EXISTS "Autoavaliacao" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "modeloId" TEXT,
    "titulo" TEXT NOT NULL,
    "instrucoes" TEXT,
    "perguntas" JSONB NOT NULL,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "respostas" JSONB,
    "avaliacaoId" TEXT,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),
    CONSTRAINT "Autoavaliacao_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Autoavaliacao_token_key" ON "Autoavaliacao"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "Autoavaliacao_avaliacaoId_key" ON "Autoavaliacao"("avaliacaoId");
CREATE INDEX IF NOT EXISTS "Autoavaliacao_employeeId_idx" ON "Autoavaliacao"("employeeId");
CREATE INDEX IF NOT EXISTS "Autoavaliacao_modeloId_idx" ON "Autoavaliacao"("modeloId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModeloDeAutoavaliacao_companyId_fkey') THEN
    ALTER TABLE "ModeloDeAutoavaliacao" ADD CONSTRAINT "ModeloDeAutoavaliacao_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModeloDeAutoavaliacao_cargoId_fkey') THEN
    ALTER TABLE "ModeloDeAutoavaliacao" ADD CONSTRAINT "ModeloDeAutoavaliacao_cargoId_fkey"
      FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PerguntaDeAutoavaliacao_modeloId_fkey') THEN
    ALTER TABLE "PerguntaDeAutoavaliacao" ADD CONSTRAINT "PerguntaDeAutoavaliacao_modeloId_fkey"
      FOREIGN KEY ("modeloId") REFERENCES "ModeloDeAutoavaliacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Autoavaliacao_employeeId_fkey') THEN
    ALTER TABLE "Autoavaliacao" ADD CONSTRAINT "Autoavaliacao_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Autoavaliacao_modeloId_fkey') THEN
    ALTER TABLE "Autoavaliacao" ADD CONSTRAINT "Autoavaliacao_modeloId_fkey"
      FOREIGN KEY ("modeloId") REFERENCES "ModeloDeAutoavaliacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Autoavaliacao_avaliacaoId_fkey') THEN
    ALTER TABLE "Autoavaliacao" ADD CONSTRAINT "Autoavaliacao_avaliacaoId_fkey"
      FOREIGN KEY ("avaliacaoId") REFERENCES "AvaliacaoDeCompetencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- Tabelas novas nascem com RLS ligado, como as outras (ver 20261015120000).
ALTER TABLE "ModeloDeAutoavaliacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerguntaDeAutoavaliacao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Autoavaliacao" ENABLE ROW LEVEL SECURITY;
