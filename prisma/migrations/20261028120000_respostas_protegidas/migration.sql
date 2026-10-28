-- Respostas enviadas por link não somem sem confirmação (regra da Ilmara, 28/10/2026).
-- O sistema só apaga uma resposta numa transação que antes rodou
--   select set_config('rh.apagar_respostas', 'sim', true)
-- (src/lib/respostas-protegidas-dados.ts, apagarComPermissao). Qualquer outro
-- caminho, inclusive a cascata de excluir o cargo, a pessoa, a pesquisa ou a
-- empresa, é recusado pelo banco.

CREATE OR REPLACE FUNCTION public.rh_protege_resposta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('rh.apagar_respostas', true), '') = 'sim' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Resposta enviada por link protegida (%): só pode ser apagada com confirmação.', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS protege_resposta ON "QuestionarioDeCargo";
CREATE TRIGGER protege_resposta BEFORE DELETE ON "QuestionarioDeCargo"
  FOR EACH ROW WHEN (OLD.status = 'RESPONDIDO') EXECUTE FUNCTION public.rh_protege_resposta();

DROP TRIGGER IF EXISTS protege_resposta ON "Autoavaliacao";
CREATE TRIGGER protege_resposta BEFORE DELETE ON "Autoavaliacao"
  FOR EACH ROW WHEN (OLD.status = 'RESPONDIDO') EXECUTE FUNCTION public.rh_protege_resposta();

DROP TRIGGER IF EXISTS protege_resposta ON "MapeamentoDeRotina";
CREATE TRIGGER protege_resposta BEFORE DELETE ON "MapeamentoDeRotina"
  FOR EACH ROW WHEN (OLD."respondidoEm" IS NOT NULL) EXECUTE FUNCTION public.rh_protege_resposta();

DROP TRIGGER IF EXISTS protege_resposta ON "RespostaDeClima";
CREATE TRIGGER protege_resposta BEFORE DELETE ON "RespostaDeClima"
  FOR EACH ROW EXECUTE FUNCTION public.rh_protege_resposta();

DROP TRIGGER IF EXISTS protege_resposta ON "Candidate";
CREATE TRIGGER protege_resposta BEFORE DELETE ON "Candidate"
  FOR EACH ROW WHEN (OLD."applicationAnsweredAt" IS NOT NULL) EXECUTE FUNCTION public.rh_protege_resposta();
