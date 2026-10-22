-- Aba Cargos: a descrição completa do cargo, o questionário de cargo mandado
-- por link e o roteiro de entrevista que a vaga copia. Só acrescenta.

ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "nivel" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "setor" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "cbo" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "superior" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "subordinados" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "especificacao" JSONB;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "perguntasDaEntrevista" JSONB;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "aprovadaEm" TIMESTAMP(3);

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "valores" TEXT;

ALTER TABLE "JobOpening" ADD COLUMN IF NOT EXISTS "cargoId" TEXT;
CREATE INDEX IF NOT EXISTS "JobOpening_cargoId_idx" ON "JobOpening"("cargoId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JobOpening_cargoId_fkey') THEN
    ALTER TABLE "JobOpening" ADD CONSTRAINT "JobOpening_cargoId_fkey"
      FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "QuestionarioDeCargo" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "pessoa" TEXT NOT NULL,
    "prazo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ENVIADO',
    "respostas" JSONB,
    "enviadoPor" TEXT,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEm" TIMESTAMP(3),
    CONSTRAINT "QuestionarioDeCargo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuestionarioDeCargo_token_key" ON "QuestionarioDeCargo"("token");
CREATE INDEX IF NOT EXISTS "QuestionarioDeCargo_cargoId_idx" ON "QuestionarioDeCargo"("cargoId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuestionarioDeCargo_cargoId_fkey') THEN
    ALTER TABLE "QuestionarioDeCargo" ADD CONSTRAINT "QuestionarioDeCargo_cargoId_fkey"
      FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- Tabela nova nasce com RLS ligado, como as outras (ver 20261015120000).
ALTER TABLE "QuestionarioDeCargo" ENABLE ROW LEVEL SECURITY;
