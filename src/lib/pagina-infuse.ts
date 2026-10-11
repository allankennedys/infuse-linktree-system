import type { Pagina } from "./pagina";
import type { ExtrasDaPagina } from "./pagina-html";
import { payloadPix } from "./pix";
import { gerarSvg } from "./qr";

/** Página de links da própria Infuse, exibida enquanto o código ainda não foi configurado. */
export const PAGINA_INFUSE: Pagina = {
  titulo: "Infuse Software",
  subtitulo: "@infuse.software",
  subtitulo_url: "https://www.instagram.com/infuse.software/",
  rodape: "Conecte-se com a gente!",
  cor_fundo: "#030305",
  cor_destaque: "#2f7bff",
  links: [
    { rotulo: "Nosso Instagram", url: "https://www.instagram.com/infuse.software/", icone: "instagram" },
    { rotulo: "Avalie no Google", url: "https://g.page/r/Cd3Xs1AHxy3TEAI/review", icone: "google" },
    { rotulo: "Nosso site", url: "https://www.infusesoftware.com/", icone: "site" },
  ],
};

export const IMAGENS_INFUSE = { logo: "/infuse-logo.svg", fundo: "/infuse-fundo.jpg" };

const CHAVE_PIX = "+5575988224505";
const PAYLOAD_PIX = payloadPix({ chave: CHAVE_PIX, nome: "INFUSE SOFTWARE", cidade: "FEIRA SANTANA" });

/** Botão "Pagar via Pix" e o tratamento azulado do fundo, como no infuse-links. */
export const EXTRAS_INFUSE: ExtrasDaPagina = {
  fundoAzulado: true,
  pix: { chave: CHAVE_PIX, exibir: "(75) 98822-4505", payload: PAYLOAD_PIX, qrSvg: gerarSvg(PAYLOAD_PIX) },
};
