-- CreateTable
CREATE TABLE "EncontroDoPlano" (
    "id" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "branchId" TEXT,
    "ordem" INTEGER NOT NULL,
    "tema" TEXT NOT NULL,
    "data" TIMESTAMP(3),
    "hora" TEXT,
    "visitId" TEXT,
    "meetingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncontroDoPlano_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EncontroDoPlano_visitId_key" ON "EncontroDoPlano"("visitId");

-- CreateIndex
CREATE UNIQUE INDEX "EncontroDoPlano_meetingId_key" ON "EncontroDoPlano"("meetingId");

-- CreateIndex
CREATE INDEX "EncontroDoPlano_planoId_idx" ON "EncontroDoPlano"("planoId");

-- AddForeignKey
ALTER TABLE "EncontroDoPlano" ADD CONSTRAINT "EncontroDoPlano_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoDeTreinamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncontroDoPlano" ADD CONSTRAINT "EncontroDoPlano_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncontroDoPlano" ADD CONSTRAINT "EncontroDoPlano_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EncontroDoPlano" ADD CONSTRAINT "EncontroDoPlano_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Os planos já criados: cada reunião do plano vira um encontro do plano.
INSERT INTO "EncontroDoPlano" ("id", "planoId", "branchId", "ordem", "tema", "data", "hora", "visitId", "meetingId", "createdAt", "updatedAt")
SELECT 'enc' || replace(gen_random_uuid()::text, '-', ''), m."planoId", m."branchId", COALESCE(m."ordemNoPlano", m."number"),
       m."title", m."date", m."startTime", m."visitId", m."id", m."createdAt", CURRENT_TIMESTAMP
FROM "Meeting" m
WHERE m."planoId" IS NOT NULL;

-- A reunião que ainda não tem nada (sem ata, participantes, arquivos ou pauta
-- e não realizada) sai da aba Reuniões: o encontro fica só na agenda, e vira
-- reunião quando for mandado para lá.
CREATE TEMP TABLE reunioes_vazias AS
SELECT m."id" FROM "Meeting" m
WHERE m."planoId" IS NOT NULL
  AND m."status" = 'AGENDADA'
  AND COALESCE(trim(m."agenda"), '') = ''
  AND NOT EXISTS (SELECT 1 FROM "MeetingItem" i WHERE i."meetingId" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "MeetingParticipant" p WHERE p."meetingId" = m."id")
  AND NOT EXISTS (SELECT 1 FROM "MeetingFile" f WHERE f."meetingId" = m."id");

UPDATE "EncontroDoPlano" SET "meetingId" = NULL WHERE "meetingId" IN (SELECT "id" FROM reunioes_vazias);
DELETE FROM "Meeting" WHERE "id" IN (SELECT "id" FROM reunioes_vazias);
DROP TABLE reunioes_vazias;
