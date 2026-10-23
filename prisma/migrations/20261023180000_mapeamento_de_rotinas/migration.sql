-- Mapeamento de rotinas: a entrevista do RH com cada pessoa sobre o que ela
-- faz, base da autoavaliação da função e do PDI. Só acrescenta.

CREATE TABLE IF NOT EXISTS "MapeamentoDeRotina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "dataDaEntrevista" TIMESTAMP(3),
    "entrevistador" TEXT,
    "versao" TEXT NOT NULL DEFAULT '1.0',
    "proximaRevisao" TIMESTAMP(3),
    "dados" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MapeamentoDeRotina_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MapeamentoDeRotina_companyId_idx" ON "MapeamentoDeRotina"("companyId");
CREATE INDEX IF NOT EXISTS "MapeamentoDeRotina_employeeId_idx" ON "MapeamentoDeRotina"("employeeId");

DO $$ BEGIN
    ALTER TABLE "MapeamentoDeRotina" ADD CONSTRAINT "MapeamentoDeRotina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "MapeamentoDeRotina" ADD CONSTRAINT "MapeamentoDeRotina_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela nova nasce com RLS ligado, como as outras (ver 20261015120000).
ALTER TABLE "MapeamentoDeRotina" ENABLE ROW LEVEL SECURITY;
