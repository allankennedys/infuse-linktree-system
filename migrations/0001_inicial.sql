-- Infuse QR: esquema inicial.

create table admins (
  id          integer generated always as identity primary key,
  email       text not null unique,
  nome        text not null,
  senha_hash  text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create table sessoes (
  id          integer generated always as identity primary key,
  token_hash  text not null unique,
  admin_id    integer not null references admins(id) on delete cascade,
  expira_em   timestamptz not null,
  criado_em   timestamptz not null default now()
);
create index sessoes_expira_idx on sessoes (expira_em);

create table lotes (
  id          integer generated always as identity primary key,
  nome        text not null,
  quantidade  integer not null check (quantidade > 0),
  status      text not null check (status in ('GERANDO', 'PRONTO', 'ERRO')),
  erro        text,
  criado_por  integer references admins(id),
  criado_em   timestamptz not null default now()
);
create index lotes_status_idx on lotes (status);

-- Número amigável de inventário. Não é segredo: o acesso público usa só o token.
create sequence qr_inventario_seq;

create table codigos (
  id               integer generated always as identity primary key,
  token            text not null unique,
  numero           integer not null unique default nextval('qr_inventario_seq'),
  lote_id          integer not null references lotes(id),
  status           text not null default 'DISPONIVEL'
                   check (status in ('DISPONIVEL', 'CONFIGURADO', 'DESATIVADO', 'ARQUIVADO')),
  destino          text,
  cliente          text,
  notas            text,
  acessos          integer not null default 0,
  ultimo_acesso_em timestamptz,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  configurado_em   timestamptz,
  criado_por       integer references admins(id),
  atualizado_por   integer references admins(id),
  constraint codigos_configurado_tem_destino check (status <> 'CONFIGURADO' or destino is not null)
);
create index codigos_status_idx on codigos (status);
create index codigos_lote_idx on codigos (lote_id);
create index codigos_cliente_idx on codigos (lower(cliente));

create table auditoria (
  id         integer generated always as identity primary key,
  em         timestamptz not null default now(),
  admin_id   integer references admins(id),
  codigo_id  integer references codigos(id),
  lote_id    integer references lotes(id),
  acao       text not null,
  meta       jsonb not null default '{}'::jsonb
);
create index auditoria_codigo_idx on auditoria (codigo_id, em desc);
create index auditoria_em_idx on auditoria (em desc);

-- Estatística agregada: total por código e por hora. Sem IP, sem user agent.
create table acessos_hora (
  codigo_id  integer not null references codigos(id) on delete cascade,
  hora       timestamptz not null,
  total      integer not null default 0,
  primary key (codigo_id, hora)
);

-- Contadores de rate limiting. A chave é um HMAC; nunca guarda IP ou e-mail em claro.
create table limites (
  chave   text not null,
  janela  timestamptz not null,
  total   integer not null default 0,
  primary key (chave, janela)
);
create index limites_janela_idx on limites (janela);
