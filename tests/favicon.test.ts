import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { configurarCodigo } from "@/lib/codigos";
import type { Db } from "@/lib/db";
import {
  baixarFavicon, faviconsDaPagina, garantirFavicons, hostDeFaviconValido, hostsComIconeDeLink, obterFavicon, type Buscar,
} from "@/lib/favicon";
import { codigosDoLote, gerarLote } from "@/lib/lotes";
import { renderizarPagina } from "@/lib/pagina-html";
import { atenderLeitura } from "@/lib/publico";
import { BASE, criarBanco } from "./apoio";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const ICO = new Uint8Array([0, 0, 1, 0, 1, 0, 16, 16]);
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

/** Serviços de mentira: `respostas` diz o que cada um devolve para cada host; o resto é 404. */
function servicos(respostas: Record<string, { google?: Uint8Array; ddg?: Uint8Array }>) {
  const pedidos: string[] = [];
  const buscar: Buscar = async (url) => {
    pedidos.push(url);
    const u = new URL(url);
    const google = u.hostname === "www.google.com";
    const host = google ? u.searchParams.get("domain")! : decodeURIComponent(u.pathname.split("/").pop()!.replace(/\.ico$/, ""));
    const corpo = respostas[host]?.[google ? "google" : "ddg"];
    return new Response(corpo ? new Uint8Array(corpo) : "nada", { status: corpo ? 200 : 404 });
  };
  return { buscar, pedidos };
}

const pagina = (links: { url: string; icone: string }[]) => ({
  titulo: "Loja", subtitulo: null, subtitulo_url: null, rodape: null, cor_fundo: "#030305", cor_destaque: "#2f7bff",
  links: links.map((l) => ({ rotulo: "Botão", ...l })),
});

describe("favicon dos botões Link", () => {
  it("só aceita nome de domínio público", () => {
    expect(hostDeFaviconValido("loja.exemplo.com.br")).toBe(true);
    for (const ruim of ["localhost", "127.0.0.1", "10.0.0.1", "exemplo", "a b.com", "exemplo.com/x", "[::1]", ""]) {
      expect(hostDeFaviconValido(ruim)).toBe(false);
    }
  });

  it("só os botões com o ícone Link e endereço https entram na busca", () => {
    const p = pagina([
      { url: "https://loja.exemplo.com/a", icone: "link" }, { url: "https://loja.exemplo.com/b", icone: "link" },
      { url: "https://instagram.com/loja", icone: "instagram" }, { url: "http://inseguro.exemplo.com", icone: "link" },
      { url: "não é url", icone: "link" },
    ]);
    expect(hostsComIconeDeLink(p)).toEqual(["loja.exemplo.com"]);
  });

  it("usa o primeiro serviço que responder com imagem; tenta também com e sem www", async () => {
    const a = servicos({ "exemplo.com": { google: PNG } });
    expect(await baixarFavicon("exemplo.com", a.buscar)).toEqual({ mime: "image/png", dados: PNG });
    expect(a.pedidos).toHaveLength(1);

    const b = servicos({ "exemplo.com": { ddg: ICO } });
    expect((await baixarFavicon("exemplo.com", b.buscar))?.mime).toBe("image/x-icon");

    const c = servicos({ "www.exemplo.com": { google: PNG } });
    expect((await baixarFavicon("exemplo.com", c.buscar))?.mime).toBe("image/png");
    expect(a.pedidos.concat(b.pedidos, c.pedidos).every((u) => /^https:\/\/(www\.google\.com|icons\.duckduckgo\.com)\//.test(u))).toBe(true);
  });

  it("recusa o que não é imagem (HTML, SVG) e serviço que falha; nunca busca host inválido", async () => {
    expect(await baixarFavicon("exemplo.com", servicos({ "exemplo.com": { google: HTML, ddg: SVG } }).buscar)).toBeNull();
    expect(await baixarFavicon("exemplo.com", async () => { throw new Error("fora do ar"); })).toBeNull();
    const s = servicos({});
    expect(await baixarFavicon("169.254.169.254", s.buscar)).toBeNull();
    expect(await baixarFavicon("localhost", s.buscar)).toBeNull();
    expect(s.pedidos).toEqual([]);
  });

  it("a página mostra o favicon só no botão Link que tem favicon guardado", () => {
    const p = pagina([
      { url: "https://loja.exemplo.com/a", icone: "link" }, { url: "https://semicone.exemplo.com/", icone: "link" },
      { url: "https://loja.exemplo.com/cardapio", icone: "cardapio" },
    ]);
    const html = renderizarPagina(p, {}, { favicons: { "loja.exemplo.com": "/icone/loja.exemplo.com?v=1" } });
    expect(html.match(/<img src="\/icone\/loja\.exemplo\.com\?v=1"/g)).toHaveLength(1);
    expect(html).not.toContain("/icone/semicone");
    expect(renderizarPagina(p)).not.toMatch(/<img/);
  });
});

describe("favicon guardado no banco", () => {
  let db: Db;
  let admin: { id: number };
  let fechar: () => Promise<void>;
  let id: number;
  let token: string;

  beforeAll(async () => {
    ({ db, admin, fechar } = await criarBanco());
    const lote = await gerarLote(db, { quantidade: 1 }, admin, BASE);
    ({ id, token } = (await codigosDoLote(db, lote.id))[0]!);
    await configurarCodigo(db, id, {
      destino: "", cliente: "", notas: "", modo: "PAGINA", confirmarAvisos: true,
      pagina: {
        titulo: "Loja", subtitulo: "", subtitulo_url: "", rodape: "", cor_fundo: "#030305", cor_destaque: "#2f7bff",
        links: [
          { rotulo: "Site", url: "https://loja.exemplo.com/", icone: "link" },
          { rotulo: "Outro", url: "https://semicone.exemplo.com/", icone: "link" },
        ],
      },
    }, admin);
  });
  afterAll(() => fechar());

  it("guarda o que achou e o que não achou; não procura de novo o que já está resolvido", async () => {
    const s = servicos({ "loja.exemplo.com": { google: PNG } });
    await garantirFavicons(db, ["loja.exemplo.com", "semicone.exemplo.com"], s.buscar);
    expect((await obterFavicon(db, "loja.exemplo.com"))?.mime).toBe("image/png");
    expect(await obterFavicon(db, "semicone.exemplo.com")).toBeNull();
    const antes = s.pedidos.length;
    await garantirFavicons(db, ["loja.exemplo.com", "semicone.exemplo.com"], s.buscar);
    expect(s.pedidos.length).toBe(antes);
  });

  it("a página pública aponta para o favicon guardado, no próprio domínio, e só para ele", async () => {
    const urls = await faviconsDaPagina(db, pagina([{ url: "https://loja.exemplo.com/", icone: "link" }, { url: "https://semicone.exemplo.com/", icone: "link" }]));
    expect(Object.keys(urls)).toEqual(["loja.exemplo.com"]);
    const html = await (await atenderLeitura(db, token)).text();
    expect(html).toMatch(/<img src="\/icone\/loja\.exemplo\.com\?v=\d+"/);
    expect(html).not.toContain("/icone/semicone");
    expect(html).not.toMatch(/google|duckduckgo/);
  });
});
