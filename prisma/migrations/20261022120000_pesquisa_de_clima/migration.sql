-- Pesquisa de clima: biblioteca de dimensões e perguntas, os ciclos de cada
-- empresa, as respostas anônimas e o plano de ação.
--
-- Só cria tabelas novas; nenhuma tabela existente muda.
-- CreateTable
CREATE TABLE "DimensaoDeClima" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DimensaoDeClima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerguntaDeClima" (
    "id" TEXT NOT NULL,
    "dimensaoId" TEXT NOT NULL,
    "companyId" TEXT,
    "enunciado" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NOTA',
    "opcoes" JSONB,
    "maxEscolhas" INTEGER,
    "enps" BOOLEAN NOT NULL DEFAULT false,
    "padrao" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerguntaDeClima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PesquisaDeClima" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "abertaEm" TIMESTAMP(3),
    "prazo" DATE,
    "encerradaEm" TIMESTAMP(3),
    "convidados" INTEGER,
    "regua" DECIMAL(4,2) NOT NULL DEFAULT 6,
    "introducao" TEXT,
    "perfil" JSONB NOT NULL,
    "conclusoes" JSONB,
    "mediasDigitadas" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PesquisaDeClima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerguntaDaPesquisa" (
    "id" TEXT NOT NULL,
    "pesquisaId" TEXT NOT NULL,
    "perguntaId" TEXT,
    "dimensao" TEXT NOT NULL,
    "dimensaoOrdem" INTEGER NOT NULL DEFAULT 0,
    "enunciado" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcoes" JSONB,
    "maxEscolhas" INTEGER,
    "enps" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerguntaDaPesquisa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RespostaDeClima" (
    "id" TEXT NOT NULL,
    "pesquisaId" TEXT NOT NULL,
    "perfil" JSONB NOT NULL,
    "respondidaEm" DATE NOT NULL,

    CONSTRAINT "RespostaDeClima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDaResposta" (
    "id" TEXT NOT NULL,
    "respostaId" TEXT NOT NULL,
    "perguntaId" TEXT NOT NULL,
    "nota" INTEGER,
    "escolhas" TEXT[],
    "texto" TEXT,
    "textoRevisado" TEXT,
    "ocultar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ItemDaResposta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcaoDeClima" (
    "id" TEXT NOT NULL,
    "pesquisaId" TEXT NOT NULL,
    "dimensao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "responsavel" TEXT,
    "prazo" DATE,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcaoDeClima_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DimensaoDeClima_ordem_idx" ON "DimensaoDeClima"("ordem");

-- CreateIndex
CREATE INDEX "PerguntaDeClima_dimensaoId_idx" ON "PerguntaDeClima"("dimensaoId");

-- CreateIndex
CREATE INDEX "PerguntaDeClima_companyId_idx" ON "PerguntaDeClima"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PesquisaDeClima_token_key" ON "PesquisaDeClima"("token");

-- CreateIndex
CREATE INDEX "PesquisaDeClima_companyId_idx" ON "PesquisaDeClima"("companyId");

-- CreateIndex
CREATE INDEX "PerguntaDaPesquisa_pesquisaId_idx" ON "PerguntaDaPesquisa"("pesquisaId");

-- CreateIndex
CREATE INDEX "PerguntaDaPesquisa_perguntaId_idx" ON "PerguntaDaPesquisa"("perguntaId");

-- CreateIndex
CREATE INDEX "RespostaDeClima_pesquisaId_idx" ON "RespostaDeClima"("pesquisaId");

-- CreateIndex
CREATE INDEX "ItemDaResposta_respostaId_idx" ON "ItemDaResposta"("respostaId");

-- CreateIndex
CREATE INDEX "ItemDaResposta_perguntaId_idx" ON "ItemDaResposta"("perguntaId");

-- CreateIndex
CREATE INDEX "AcaoDeClima_pesquisaId_idx" ON "AcaoDeClima"("pesquisaId");

-- AddForeignKey
ALTER TABLE "PerguntaDeClima" ADD CONSTRAINT "PerguntaDeClima_dimensaoId_fkey" FOREIGN KEY ("dimensaoId") REFERENCES "DimensaoDeClima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerguntaDeClima" ADD CONSTRAINT "PerguntaDeClima_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PesquisaDeClima" ADD CONSTRAINT "PesquisaDeClima_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerguntaDaPesquisa" ADD CONSTRAINT "PerguntaDaPesquisa_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "PesquisaDeClima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerguntaDaPesquisa" ADD CONSTRAINT "PerguntaDaPesquisa_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "PerguntaDeClima"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RespostaDeClima" ADD CONSTRAINT "RespostaDeClima_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "PesquisaDeClima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDaResposta" ADD CONSTRAINT "ItemDaResposta_respostaId_fkey" FOREIGN KEY ("respostaId") REFERENCES "RespostaDeClima"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDaResposta" ADD CONSTRAINT "ItemDaResposta_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "PerguntaDaPesquisa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcaoDeClima" ADD CONSTRAINT "AcaoDeClima_pesquisaId_fkey" FOREIGN KEY ("pesquisaId") REFERENCES "PesquisaDeClima"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- As tabelas novas nascem fechadas para a API automática do Supabase, como as
-- outras (ver 20261015120000_rls_e_permissoes). O sistema usa o Prisma.
ALTER TABLE "DimensaoDeClima" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerguntaDeClima" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PesquisaDeClima" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerguntaDaPesquisa" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RespostaDeClima" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemDaResposta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcaoDeClima" ENABLE ROW LEVEL SECURITY;
