-- Reunião ou tarefa: o que já estava na agenda continua como reunião.
CREATE TYPE "VisitNatureza" AS ENUM ('REUNIAO', 'TAREFA');

ALTER TABLE "Visit" ADD COLUMN "natureza" "VisitNatureza" NOT NULL DEFAULT 'REUNIAO';
