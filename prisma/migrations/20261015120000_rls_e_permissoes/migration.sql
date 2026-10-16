-- Fecha a API automática do Supabase (PostgREST) para as tabelas do sistema.
--
-- O sistema só fala com o banco pelo Prisma, como o dono das tabelas
-- (postgres), que ignora o RLS. Sem isto, quem tivesse a chave pública
-- ("anon") do projeto conseguia ler e apagar qualquer tabela pela API REST.
--
-- Idempotente e seguro fora do Supabase: no Postgres local os papéis anon e
-- authenticated não existem e essa parte é pulada.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    -- Tabelas criadas por migrações futuras já nascem fechadas.
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated';
  END IF;
END
$$;
