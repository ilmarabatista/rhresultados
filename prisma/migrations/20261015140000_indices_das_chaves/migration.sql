-- Índices das chaves estrangeiras que as telas consultam (advisor do Supabase).
-- IF NOT EXISTS: pode rodar de novo sem erro.

CREATE INDEX IF NOT EXISTS "AvaliacaoDeCompetencias_cargoId_idx" ON "AvaliacaoDeCompetencias"("cargoId");
CREATE INDEX IF NOT EXISTS "Candidate_etapaId_idx" ON "Candidate"("etapaId");
CREATE INDEX IF NOT EXISTS "DevelopmentAction_treinamentoId_idx" ON "DevelopmentAction"("treinamentoId");
CREATE INDEX IF NOT EXISTS "DevelopmentPlan_avaliacaoId_idx" ON "DevelopmentPlan"("avaliacaoId");
CREATE INDEX IF NOT EXISTS "Employee_branchId_idx" ON "Employee"("branchId");
CREATE INDEX IF NOT EXISTS "Employee_cargoId_idx" ON "Employee"("cargoId");
CREATE INDEX IF NOT EXISTS "EncontroDoPlano_branchId_idx" ON "EncontroDoPlano"("branchId");
CREATE INDEX IF NOT EXISTS "Meeting_planoId_idx" ON "Meeting"("planoId");
CREATE INDEX IF NOT EXISTS "Meeting_serviceId_idx" ON "Meeting"("serviceId");
CREATE INDEX IF NOT EXISTS "MetaDoPdi_notaId_idx" ON "MetaDoPdi"("notaId");
CREATE INDEX IF NOT EXISTS "NotaDeCompetencia_competenciaId_idx" ON "NotaDeCompetencia"("competenciaId");
CREATE INDEX IF NOT EXISTS "PlanoDeTreinamento_serviceId_idx" ON "PlanoDeTreinamento"("serviceId");
CREATE INDEX IF NOT EXISTS "ProgressoDaMeta_conversaId_idx" ON "ProgressoDaMeta"("conversaId");
CREATE INDEX IF NOT EXISTS "TesteEnviado_companyId_idx" ON "TesteEnviado"("companyId");
CREATE INDEX IF NOT EXISTS "TesteEnviado_customTestId_idx" ON "TesteEnviado"("customTestId");
CREATE INDEX IF NOT EXISTS "TreinamentoDoCargo_cargoId_idx" ON "TreinamentoDoCargo"("cargoId");
CREATE INDEX IF NOT EXISTS "Visit_consultantId_idx" ON "Visit"("consultantId");
CREATE INDEX IF NOT EXISTS "Visit_serviceId_idx" ON "Visit"("serviceId");
