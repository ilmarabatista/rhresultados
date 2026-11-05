-- CreateEnum
CREATE TYPE "TipoDoDiaDaEscala" AS ENUM ('TRABALHO', 'FOLGA', 'FERIAS', 'ATESTADO');

-- CreateTable
CREATE TABLE "RegrasDaEscala" (
    "companyId" TEXT NOT NULL,
    "funcionamento" JSONB NOT NULL,
    "minimo" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegrasDaEscala_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "TurnoDaEscala" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "inicio" INTEGER NOT NULL,
    "fim" INTEGER NOT NULL,
    "intervalo" INTEGER NOT NULL DEFAULT 60,
    "cor" TEXT NOT NULL DEFAULT 'azul',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnoDaEscala_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaDaEscala" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "tipo" "TipoDoDiaDaEscala" NOT NULL,
    "turnoId" TEXT,
    "inicio" INTEGER,
    "fim" INTEGER,
    "intervalo" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaDaEscala_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TurnoDaEscala_companyId_idx" ON "TurnoDaEscala"("companyId");

-- CreateIndex
CREATE INDEX "DiaDaEscala_companyId_data_idx" ON "DiaDaEscala"("companyId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "DiaDaEscala_employeeId_data_key" ON "DiaDaEscala"("employeeId", "data");

-- AddForeignKey
ALTER TABLE "RegrasDaEscala" ADD CONSTRAINT "RegrasDaEscala_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnoDaEscala" ADD CONSTRAINT "TurnoDaEscala_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaDaEscala" ADD CONSTRAINT "DiaDaEscala_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaDaEscala" ADD CONSTRAINT "DiaDaEscala_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaDaEscala" ADD CONSTRAINT "DiaDaEscala_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoDaEscala"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Como as demais tabelas: só o servidor (dono das tabelas) lê e grava.
ALTER TABLE "RegrasDaEscala" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TurnoDaEscala" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiaDaEscala" ENABLE ROW LEVEL SECURITY;
