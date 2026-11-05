-- Assinatura de carteira: a admissão e os documentos que o funcionário manda pelo link.
-- Cria duas tabelas novas. Na tabela de unidades (Branch) só acrescenta duas
-- colunas vazias, CNPJ e razão social, porque a Oral-C tem um CNPJ por cidade.

ALTER TABLE "Branch" ADD COLUMN "cnpj" TEXT, ADD COLUMN "legalName" TEXT;

-- CreateTable
CREATE TABLE "Admissao" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "employeeId" TEXT,
    "cnpj" TEXT NOT NULL,
    "razaoSocial" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "funcao" TEXT NOT NULL,
    "telefone" TEXT,
    "dataAdmissao" TIMESTAMP(3),
    "observacoes" TEXT,
    "token" TEXT NOT NULL,
    "enviadoAoMedicoEm" TIMESTAMP(3),
    "linkEnviadoEm" TIMESTAMP(3),
    "documentosEnviadosEm" TIMESTAMP(3),
    "pacoteGeradoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admissao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoDaAdmissao" (
    "id" TEXT NOT NULL,
    "admissaoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dados" BYTEA NOT NULL,
    "enviadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoDaAdmissao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admissao_token_key" ON "Admissao"("token");

-- CreateIndex
CREATE INDEX "Admissao_companyId_createdAt_idx" ON "Admissao"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentoDaAdmissao_admissaoId_tipo_idx" ON "DocumentoDaAdmissao"("admissaoId", "tipo");

-- AddForeignKey
ALTER TABLE "Admissao" ADD CONSTRAINT "Admissao_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admissao" ADD CONSTRAINT "Admissao_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admissao" ADD CONSTRAINT "Admissao_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoDaAdmissao" ADD CONSTRAINT "DocumentoDaAdmissao_admissaoId_fkey" FOREIGN KEY ("admissaoId") REFERENCES "Admissao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Como as outras tabelas: RLS ligado, sem política (o sistema acessa pelo servidor).
ALTER TABLE "Admissao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentoDaAdmissao" ENABLE ROW LEVEL SECURITY;
