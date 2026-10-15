-- Trocar a senha invalida as sessões abertas: o cookie guarda a versão, e a
-- sessão só vale enquanto ela for igual à do usuário.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
