-- Favicon dos sites de destino, para os botões "Link" da página de links. Cópia guardada aqui:
-- a página pública só carrega imagens do próprio domínio. Uma linha por host, compartilhada entre códigos.
-- `dados` nulo = já procuramos e não havia; serve para não procurar de novo a cada salvamento.

create table favicons (
  host        text primary key,
  mime        text check (mime in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/x-icon')),
  dados       bytea,
  buscado_em  timestamptz not null default now(),
  check ((mime is null) = (dados is null))
);

alter table favicons enable row level security;
