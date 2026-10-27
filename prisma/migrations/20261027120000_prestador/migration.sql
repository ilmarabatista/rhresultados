-- Prestador de serviço: a pessoa que não é funcionária fica fora do PDI e da
-- autoavaliação. Só acrescenta uma coluna, com falso para todo mundo.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "prestador" BOOLEAN NOT NULL DEFAULT false;
