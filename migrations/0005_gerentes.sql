-- Gerente: usuário do cliente, que entra numa área própria e edita só os códigos ligados a ele.
-- Não é administrador: sessão e cookie são separados, e nenhuma rota do painel aceita essa sessão.

create table gerentes (
  id          integer generated always as identity primary key,
  usuario     text not null unique,
  senha_hash  text not null,
  ativo       boolean not null default true,
  criado_por  integer references admins(id),
  criado_em   timestamptz not null default now()
);

create table sessoes_gerente (
  id          integer generated always as identity primary key,
  token_hash  text not null unique,
  gerente_id  integer not null references gerentes(id) on delete cascade,
  expira_em   timestamptz not null,
  criado_em   timestamptz not null default now()
);
create index sessoes_gerente_expira_idx on sessoes_gerente (expira_em);

alter table codigos add column gerente_id integer references gerentes(id) on delete set null;
create index codigos_gerente_idx on codigos (gerente_id);

-- Quem fez a alteração: um administrador (admin_id) ou o gerente do código (gerente_id).
alter table auditoria add column gerente_id integer references gerentes(id) on delete set null;

alter table gerentes        enable row level security;
alter table sessoes_gerente enable row level security;
