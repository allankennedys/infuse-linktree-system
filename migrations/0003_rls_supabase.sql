-- Em Supabase, tabelas do schema public ficam acessíveis pela Data API (PostgREST) com a chave pública.
-- Este app só fala com o banco pela DATABASE_URL (dono das tabelas, que ignora RLS), então ligamos RLS
-- sem nenhuma policy: a API pública passa a não ler nem escrever nada. Em Postgres comum não muda nada.

alter table schema_migrations enable row level security;
alter table admins            enable row level security;
alter table sessoes           enable row level security;
alter table lotes             enable row level security;
alter table codigos           enable row level security;
alter table auditoria         enable row level security;
alter table acessos_hora      enable row level security;
alter table limites           enable row level security;
alter table paginas           enable row level security;
alter table pagina_links      enable row level security;
alter table imagens           enable row level security;
