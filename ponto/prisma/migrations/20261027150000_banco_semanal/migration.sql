-- Banco de horas por semana (opção da empresa; desligada em todas).
ALTER TABLE "Empresa" ADD COLUMN "bancoSemanal" BOOLEAN NOT NULL DEFAULT false;
