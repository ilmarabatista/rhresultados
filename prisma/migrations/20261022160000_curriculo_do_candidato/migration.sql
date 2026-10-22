-- O currículo em PDF do candidato, guardado no banco como os anexos da reunião.
CREATE TABLE "ArquivoDoCandidato" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "enviadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArquivoDoCandidato_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArquivoDoCandidato_candidateId_idx" ON "ArquivoDoCandidato"("candidateId");

ALTER TABLE "ArquivoDoCandidato" ADD CONSTRAINT "ArquivoDoCandidato_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Como todas as tabelas desde a auditoria: fechada para a API pública do Supabase.
ALTER TABLE "ArquivoDoCandidato" ENABLE ROW LEVEL SECURITY;
