-- Pedidos do colaborador (atestado e correção de batida), aprovados pelo RH.
-- Só acrescenta: nenhuma tabela existente muda.

CREATE TYPE "TipoPedido" AS ENUM ('ATESTADO', 'CORRECAO');
CREATE TYPE "SituacaoPedido" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO');

CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" "TipoPedido" NOT NULL,
    "situacao" "SituacaoPedido" NOT NULL DEFAULT 'PENDENTE',
    "dia" TIMESTAMP(3) NOT NULL,
    "ate" TIMESTAMP(3),
    "marcacaoId" TEXT,
    "minutos" INTEGER,
    "era" TEXT,
    "motivo" TEXT,
    "decididoEm" TIMESTAMP(3),
    "decididoPor" TEXT,
    "resposta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnexoPedido" (
    "pedidoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" BYTEA NOT NULL,

    CONSTRAINT "AnexoPedido_pkey" PRIMARY KEY ("pedidoId")
);

CREATE INDEX "Pedido_empresaId_situacao_idx" ON "Pedido"("empresaId", "situacao");
CREATE INDEX "Pedido_colaboradorId_createdAt_idx" ON "Pedido"("colaboradorId", "createdAt");

ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnexoPedido" ADD CONSTRAINT "AnexoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
