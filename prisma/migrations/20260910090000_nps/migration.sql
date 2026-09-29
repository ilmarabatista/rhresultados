-- CreateTable
CREATE TABLE "NpsRound" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "promotores" INTEGER NOT NULL DEFAULT 0,
    "neutros" INTEGER NOT NULL DEFAULT 0,
    "detratores" INTEGER NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "plano" TEXT,
    "visitId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NpsRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NpsRound_visitId_key" ON "NpsRound"("visitId");

-- CreateIndex
CREATE INDEX "NpsRound_companyId_date_idx" ON "NpsRound"("companyId", "date");

-- AddForeignKey
ALTER TABLE "NpsRound" ADD CONSTRAINT "NpsRound_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsRound" ADD CONSTRAINT "NpsRound_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NpsRound" ADD CONSTRAINT "NpsRound_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

