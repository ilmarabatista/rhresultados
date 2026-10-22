-- A pasta do candidato na vaga: o roteiro da entrevista fica na vaga, e a
-- entrevista organizada fica no candidato. A ficha usa as colunas que o
-- candidato já tinha (applicationAnswers e afins).
ALTER TABLE "JobOpening" ADD COLUMN IF NOT EXISTS "perguntasDaEntrevista" JSONB;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "entrevista" JSONB;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "entrevistaEm" TIMESTAMP(3);
