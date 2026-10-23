-- Mapeamento de rotinas por link: a própria pessoa preenche as seções dela.
-- Só acrescenta colunas; os mapeamentos que já existem ficam como RASCUNHO.

ALTER TABLE "MapeamentoDeRotina" ADD COLUMN IF NOT EXISTS "token" TEXT;
ALTER TABLE "MapeamentoDeRotina" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'RASCUNHO';
ALTER TABLE "MapeamentoDeRotina" ADD COLUMN IF NOT EXISTS "enviadoEm" TIMESTAMP(3);
ALTER TABLE "MapeamentoDeRotina" ADD COLUMN IF NOT EXISTS "respondidoEm" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "MapeamentoDeRotina_token_key" ON "MapeamentoDeRotina"("token");
