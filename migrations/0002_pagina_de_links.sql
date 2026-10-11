-- Opção B: em vez de redirecionar, o código mostra uma página de links personalizável.

alter table codigos add column modo text not null default 'LINK' check (modo in ('LINK', 'PAGINA'));

-- CONFIGURADO exige destino no modo LINK; no modo PAGINA o conteúdo fica em `paginas`.
alter table codigos drop constraint codigos_configurado_tem_destino;
alter table codigos add constraint codigos_configurado_tem_destino
  check (status <> 'CONFIGURADO' or modo = 'PAGINA' or destino is not null);

create table paginas (
  codigo_id      integer primary key references codigos(id) on delete cascade,
  titulo         text not null,
  subtitulo      text,
  subtitulo_url  text,
  rodape         text,
  cor_fundo      text not null default '#030305' check (cor_fundo ~ '^#[0-9a-f]{6}$'),
  cor_destaque   text not null default '#2f7bff' check (cor_destaque ~ '^#[0-9a-f]{6}$'),
  atualizado_em  timestamptz not null default now()
);

create table pagina_links (
  id         integer generated always as identity primary key,
  codigo_id  integer not null references paginas(codigo_id) on delete cascade,
  posicao    integer not null,
  rotulo     text not null,
  url        text not null,
  icone      text not null default 'link',
  unique (codigo_id, posicao)
);

-- Logo e imagem de fundo ficam no próprio banco: sem serviço de arquivos externo.
create table imagens (
  codigo_id      integer not null references codigos(id) on delete cascade,
  tipo           text not null check (tipo in ('logo', 'fundo')),
  mime           text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  dados          bytea not null,
  atualizado_em  timestamptz not null default now(),
  primary key (codigo_id, tipo)
);
