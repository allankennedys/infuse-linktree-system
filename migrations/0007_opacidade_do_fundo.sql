-- Opacidade da imagem de fundo da página de links, de 0 a 100 (%). Abaixo de 100, a imagem esmaece.
-- O padrão 100 mantém as páginas existentes como estão.

alter table paginas add column fundo_opacidade integer not null default 100
  check (fundo_opacidade between 0 and 100);
