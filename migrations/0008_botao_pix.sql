-- Botão Pix na página de links: em vez de abrir um endereço, mostra o QR Code e a chave.
-- Nesses botões `url` fica vazia e as três colunas abaixo vêm preenchidas; nos demais, ficam nulas.

alter table pagina_links
  add column pix_chave  text,
  add column pix_nome   text,
  add column pix_cidade text,
  add constraint pagina_links_pix_completo check (
    (pix_chave is null and pix_nome is null and pix_cidade is null)
    or (pix_chave is not null and pix_nome is not null and pix_cidade is not null and url = '')
  );
