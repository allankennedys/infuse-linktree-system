import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { historicoDoCodigo } from "@/lib/auditoria";
import { configurarCodigo, obterCodigo, operarCodigo, resolverToken } from "@/lib/codigos";
import type { Db } from "@/lib/db";
import { codigosDoLote, gerarLote } from "@/lib/lotes";
import {
  detectarMime, obterImagem, obterPagina, salvarImagem, validarImagem, validarPagina, type EntradaPagina,
} from "@/lib/pagina";
import { renderizarPagina } from "@/lib/pagina-html";
import { atenderLeitura } from "@/lib/publico";
import { gerarPng } from "@/lib/qr";
import { BASE, criarBanco } from "./apoio";

let db: Db;
let admin: { id: number };
let fechar: () => Promise<void>;
let id: number;
let token: string;

const pagina = (extra: Partial<EntradaPagina> = {}): EntradaPagina => ({
  titulo: "Padaria do Zé", subtitulo: "@padariadoze", subtitulo_url: "https://instagram.com/padariadoze",
  rodape: "Volte sempre!", cor_fundo: "#102030", cor_destaque: "#FFAA00",
  links: [
    { rotulo: "Cardápio", url: "https://padaria.exemplo.com/cardapio", icone: "cardapio" },
    { rotulo: "WhatsApp", url: "https://wa.me/5511999999999", icone: "conversa" },
  ],
  ...extra,
});
const sim = { confirmarAvisos: true, confirmarReassociacao: true };
const salvarPaginaNoCodigo = (p: EntradaPagina, extra = {}) =>
  configurarCodigo(db, id, { destino: "", cliente: "Padaria", notas: "", modo: "PAGINA", pagina: p, ...sim, ...extra }, admin);

beforeAll(async () => {
  ({ db, admin, fechar } = await criarBanco());
  const lote = await gerarLote(db, { quantidade: 2 }, admin, BASE);
  ({ id, token } = (await codigosDoLote(db, lote.id))[0]!);
});
afterAll(() => fechar());

describe("validação da página de links", () => {
  it("normaliza cores e endereços e ignora linhas de link vazias", () => {
    const r = validarPagina(pagina({ links: [...pagina().links, { rotulo: " ", url: "", icone: "link" }] }));
    expect(r).toMatchObject({ ok: true, pagina: { cor_destaque: "#ffaa00", links: [{ icone: "cardapio" }, { icone: "conversa" }] } });
  });
  it.each([
    ["sem título", { titulo: "  " }],
    ["sem links", { links: [] }],
    ["link javascript:", { links: [{ rotulo: "x", url: "javascript:alert(1)", icone: "link" }] }],
    ["link http", { links: [{ rotulo: "x", url: "http://exemplo.com", icone: "link" }] }],
    ["link sem texto", { links: [{ rotulo: "", url: "https://exemplo.com", icone: "link" }] }],
    ["cor inválida", { cor_fundo: "red; background:url(https://mau.test)" }],
    ["subtítulo com link inválido", { subtitulo_url: "data:text/html,x" }],
    ["link do subtítulo sem subtítulo", { subtitulo: "" }],
    ["links demais", { links: Array.from({ length: 13 }, (_, i) => ({ rotulo: `L${i}`, url: "https://exemplo.com", icone: "link" })) }],
  ])("recusa: %s", (_, extra) => {
    expect(validarPagina(pagina(extra as Partial<EntradaPagina>)).ok).toBe(false);
  });
  it("ícone desconhecido vira o ícone padrão", () => {
    const r = validarPagina(pagina({ links: [{ rotulo: "x", url: "https://exemplo.com", icone: "<svg onload=1>" }] }));
    expect(r.ok && r.pagina.links[0]!.icone).toBe("link");
  });
});

describe("HTML público", () => {
  it("escapa todo texto do banco e não contém script nem recurso de terceiros", () => {
    const html = renderizarPagina({
      titulo: `<script>alert(1)</script>"><img src=x onerror=alert(2)>`, subtitulo: "</p><script>x</script>", subtitulo_url: null,
      rodape: "a & b <b>", cor_fundo: "#ffffff", cor_destaque: "#2f7bff",
      links: [{ rotulo: `"><script>alert(3)</script>`, url: `https://exemplo.com/?a="><script>alert(4)</script>`, icone: "link" }],
    });
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img\b/i); // "onerror=" só pode aparecer como texto escapado
    expect(html).toContain("&lt;img src=x onerror=alert(2)&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toMatch(/https?:\/\/(?!exemplo\.com)[a-z]/); // nenhuma URL além do link do cliente
  });
  it("descarta link ou cor que não passem na conferência final", () => {
    const html = renderizarPagina({
      titulo: "T", subtitulo: null, subtitulo_url: null, rodape: null, cor_fundo: "url(x)", cor_destaque: "#2f7bff",
      links: [{ rotulo: "ruim", url: "javascript:alert(1)", icone: "link" }, { rotulo: "bom", url: "https://exemplo.com/", icone: "site" }],
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("url(x)");
    expect(html).toContain("https://exemplo.com/");
  });
  it("usa texto escuro em fundo claro e claro em fundo escuro", () => {
    const base = { titulo: "T", subtitulo: null, subtitulo_url: null, rodape: null, cor_destaque: "#2f7bff", links: [] };
    expect(renderizarPagina({ ...base, cor_fundo: "#ffffff" })).toContain("color:#12151f");
    expect(renderizarPagina({ ...base, cor_fundo: "#000000" })).toContain("color:#f5f7fa");
  });
});

describe("opção B no mesmo QR", () => {
  it("página nova com domínios novos pede confirmação e nada é salvo antes", async () => {
    const r = await configurarCodigo(db, id, { destino: "", cliente: "", notas: "", modo: "PAGINA", pagina: pagina() }, admin);
    expect(r.tipo).toBe("confirmar");
    expect(await obterPagina(db, id)).toBeNull();
    expect((await obterCodigo(db, id))!.modo).toBe("LINK");
  });

  it("salva a página: o QR passa a abrir a página na própria URL, sem redirecionar", async () => {
    expect((await salvarPaginaNoCodigo(pagina())).tipo).toBe("salvo");
    expect(await obterCodigo(db, id)).toMatchObject({ modo: "PAGINA", status: "CONFIGURADO", pagina_titulo: "Padaria do Zé" });
    const r = await atenderLeitura(db, token);
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(r.headers.get("location")).toBeNull();
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(html).toContain("Padaria do Zé");
    expect(html).toContain('href="https://wa.me/5511999999999"');
    expect(html).toContain("background:#102030");
    // Dados internos não vazam na página pública.
    expect(html).not.toMatch(/Padaria<|IQ-0|notas/);
  });

  it("editar a página muda o conteúdo sem mudar o token", async () => {
    await salvarPaginaNoCodigo(pagina({ titulo: "Padaria Nova", links: [{ rotulo: "Só um", url: "https://padaria.exemplo.com/novo", icone: "site" }] }));
    expect((await obterCodigo(db, id))!.token).toBe(token);
    const html = await (await atenderLeitura(db, token)).text();
    expect(html).toContain("Padaria Nova");
    expect(html).not.toContain("wa.me");
  });

  it("logo e fundo: aceita só PNG/JPG/WebP reais dentro do limite", async () => {
    const png = gerarPng("https://exemplo.com");
    expect(detectarMime(png)).toBe("image/png");
    expect(validarImagem("logo", png)).toEqual({ ok: true, mime: "image/png" });
    expect(validarImagem("logo", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>')).ok).toBe(false);
    expect(validarImagem("logo", new TextEncoder().encode("<html>")).ok).toBe(false);
    expect(validarImagem("logo", new Uint8Array(0)).ok).toBe(false);
    const grande = new Uint8Array(700 * 1024);
    grande.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validarImagem("logo", grande).ok).toBe(false);
    expect(validarImagem("fundo", grande).ok).toBe(true);

    await salvarImagem(db, id, "logo", "image/png", png);
    const lida = await obterImagem(db, id, "logo");
    expect(Buffer.from(lida!.dados).equals(png)).toBe(true);
    const html = await (await atenderLeitura(db, token)).text();
    expect(html).toMatch(new RegExp(`src="/q/${token}/img/logo\\?v=\\d+"`));
  });

  it("voltar para a opção A redireciona de novo; a página fica guardada para reuso", async () => {
    await configurarCodigo(db, id, { destino: "https://padaria.exemplo.com/pix", cliente: "Padaria", notas: "", modo: "LINK", ...sim }, admin);
    const r = await atenderLeitura(db, token);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://padaria.exemplo.com/pix");
    expect((await obterPagina(db, id))!.titulo).toBe("Padaria Nova");

    await salvarPaginaNoCodigo(pagina({ titulo: "Padaria Nova", links: [{ rotulo: "Só um", url: "https://padaria.exemplo.com/novo", icone: "site" }] }));
    expect((await atenderLeitura(db, token)).status).toBe(200);
    expect((await obterCodigo(db, id))!.destino).toBe("https://padaria.exemplo.com/pix");
  });

  it("desativado ou arquivado: nem a página nem as imagens ficam acessíveis; reativar restaura a página", async () => {
    await operarCodigo(db, id, "desativar", admin, true);
    const r = await atenderLeitura(db, token);
    expect(r.status).toBe(404);
    expect(await r.text()).not.toContain("Padaria");
    expect(await resolverToken(db, token)).toBeNull(); // a rota de imagem depende disto
    await operarCodigo(db, id, "reativar", admin, false);
    expect((await obterCodigo(db, id))!.status).toBe("CONFIGURADO");
    expect((await atenderLeitura(db, token)).status).toBe(200);
  });

  it("links fora da política atual somem; sem nenhum link válido a página sai do ar", async () => {
    await salvarPaginaNoCodigo(pagina());
    const html = await (await atenderLeitura(db, token, { hostsPermitidos: ["wa.me"] })).text();
    expect(html).toContain("wa.me");
    expect(html).not.toContain("padaria.exemplo.com");
    expect(html).not.toContain("instagram.com/padariadoze");
    expect((await atenderLeitura(db, token, { hostsPermitidos: ["outro.com"] })).status).toBe(404);
  });

  it("histórico registra a troca de modo e as edições sem guardar o conteúdo da página", async () => {
    const h = await historicoDoCodigo(db, id);
    expect(h.map((e) => e.acao)).toEqual(expect.arrayContaining(["MODO_ALTERADO", "PAGINA_ALTERADA"]));
    expect(JSON.stringify(h)).not.toMatch(/Padaria do Zé|Volte sempre|cardapio"/);
  });

  it("remover dados do cliente apaga página, links e imagens", async () => {
    const c = await operarCodigo(db, id, "limpar-dados", admin, true);
    expect(c).toMatchObject({ status: "DISPONIVEL", modo: "LINK", destino: null, pagina_titulo: null });
    expect(await obterPagina(db, id)).toBeNull();
    expect(await obterImagem(db, id, "logo")).toBeNull();
    expect((await db.query("select 1 from pagina_links where codigo_id = $1", [id])).rows).toHaveLength(0);
    const resposta = await atenderLeitura(db, token);
    expect(resposta.status).toBe(200);
    const html = await resposta.text();
    expect(html).toContain("Infuse Software");
    expect(html).not.toMatch(/Padaria do Zé|padaria\.exemplo\.com|padariadoze/);
  });
});
