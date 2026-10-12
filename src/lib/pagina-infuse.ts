import type { Pagina } from "./pagina";
import type { ExtrasDaPagina } from "./pagina-html";

/** Página de links da própria Infuse, exibida enquanto o código ainda não foi configurado. */
export const PAGINA_INFUSE: Pagina = {
  titulo: "Infuse Software",
  subtitulo: "@infuse.software",
  subtitulo_url: "https://www.instagram.com/infuse.software/",
  rodape: "Conecte-se com a gente!",
  cor_fundo: "#030305",
  cor_destaque: "#2f7bff",
  links: [
    { rotulo: "Pagar via Pix", url: "", icone: "pix", pix: { chave: "+5575988224505", nome: "INFUSE SOFTWARE", cidade: "FEIRA SANTANA" } },
    { rotulo: "Nosso Instagram", url: "https://www.instagram.com/infuse.software/", icone: "instagram" },
    { rotulo: "Avalie no Google", url: "https://g.page/r/Cd3Xs1AHxy3TEAI/review", icone: "google" },
    { rotulo: "Nosso site", url: "https://www.infusesoftware.com/", icone: "site" },
  ],
};

export const IMAGENS_INFUSE = { logo: "/infuse-logo.svg", fundo: "/infuse-fundo.jpg" };

/** O tratamento azulado do fundo, como no infuse-links. */
export const EXTRAS_INFUSE: ExtrasDaPagina = { fundoAzulado: true };
