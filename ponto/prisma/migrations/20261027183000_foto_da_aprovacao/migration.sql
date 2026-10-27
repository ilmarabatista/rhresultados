-- A foto que o colaborador tira ao aprovar o espelho do mês.
CREATE TABLE "FotoRelatorio" (
    "relatorioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'image/jpeg',
    "dados" BYTEA NOT NULL,

    CONSTRAINT "FotoRelatorio_pkey" PRIMARY KEY ("relatorioId")
);

ALTER TABLE "FotoRelatorio" ADD CONSTRAINT "FotoRelatorio_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "Relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
