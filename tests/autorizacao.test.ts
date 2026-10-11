import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { codigosDoLote, gerarLote } from "@/lib/lotes";
import { criarSessao } from "@/lib/sessao";
import { BASE, criarBanco } from "./apoio";

// Exercita as server actions e os route handlers de verdade, trocando só o que
// depende do runtime do Next: cookies, redirect e a conexão com o banco.
const estado = vi.hoisted(() => ({ db: undefined as unknown, cookie: undefined as string | undefined }));

vi.mock("@/lib/db", async (original) => ({
  ...(await original<typeof import("@/lib/db")>()),
  getDb: () => estado.db,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) => (estado.cookie ? { name: nome, value: estado.cookie } : undefined),
    set: () => {},
    delete: () => {},
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("fora de um request");
  },
}));

let db: Db;
let admin: { id: number };
let fechar: () => Promise<void>;
let codigo: { id: number; token: string };
let loteId: number;
let sessao: string;

const formulario = (campos: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
};
const fotografia = async () =>
  JSON.stringify((await db.query("select id, status, destino, cliente, notas from codigos order by id")).rows) +
  JSON.stringify((await db.query("select count(*) from lotes")).rows);

beforeAll(async () => {
  process.env.APP_BASE_URL = BASE;
  process.env.SESSION_SECRET = "x".repeat(40);
  ({ db, admin, fechar } = await criarBanco());
  estado.db = db;
  const lote = await gerarLote(db, { quantidade: 2 }, admin, BASE);
  loteId = lote.id;
  codigo = (await codigosDoLote(db, lote.id))[0]!;
  sessao = await criarSessao(db, admin.id);
});
afterAll(() => fechar());
beforeEach(() => {
  estado.cookie = undefined;
});

describe("sem autenticação", () => {
  it.each([undefined, "cookie-forjado"])("server actions não alteram nada (cookie: %s)", async (cookie) => {
    estado.cookie = cookie;
    const acoes = await import("@/app/(painel)/acoes");
    const antes = await fotografia();

    await expect(
      acoes.acaoConfigurar({ tipo: "inicial" }, formulario({
        id: String(codigo.id), destino: "https://invasor.exemplo.com/", cliente: "x", notas: "",
        confirmarAvisos: "on", confirmarReassociacao: "on",
      })),
    ).rejects.toThrow("REDIRECT:/login");
    for (const operacao of ["desativar", "arquivar", "limpar-dados", "reativar"]) {
      await expect(
        acoes.acaoOperar({}, formulario({ id: String(codigo.id), operacao, confirmar: "on" })),
      ).rejects.toThrow("REDIRECT:/login");
    }
    await expect(acoes.acaoGerarLote({}, formulario({ quantidade: "5", nome: "x" }))).rejects.toThrow("REDIRECT:/login");
    const imagem = formulario({ id: String(codigo.id), tipo: "logo" });
    imagem.set("arquivo", new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "logo.png"));
    await expect(acoes.acaoImagem({}, imagem)).rejects.toThrow("REDIRECT:/login");
    expect((await db.query("select 1 from imagens")).rows).toHaveLength(0);

    expect(await fotografia()).toBe(antes);
  });

  it("downloads de PNG, ZIP, PDF e CSV respondem 401 sem conteúdo", async () => {
    const png = await import("@/app/api/codigos/[id]/png/route");
    const lote = await import("@/app/api/lotes/[id]/[formato]/route");
    const r1 = await png.GET(new Request(`${BASE}/api/codigos/${codigo.id}/png`), { params: Promise.resolve({ id: String(codigo.id) }) });
    expect(r1.status).toBe(401);
    expect(r1.headers.get("content-type")).not.toContain("image");
    for (const formato of ["zip", "pdf", "csv"]) {
      const r = await lote.GET(
        new Request(`${BASE}/api/lotes/${loteId}/${formato}`, { headers: { cookie: "iqr_sessao=forjado" } }),
        { params: Promise.resolve({ id: String(loteId), formato }) });
      expect(r.status).toBe(401);
      expect(await r.text()).not.toContain(codigo.token);
    }
  });

  it("prévia e imagens do painel respondem 401; imagem pública de código sem página responde 404", async () => {
    const previa = await import("@/app/api/codigos/[id]/previa/route");
    const imagem = await import("@/app/api/codigos/[id]/imagem/[tipo]/route");
    const publica = await import("@/app/q/[token]/img/[tipo]/route");
    const id = String(codigo.id);
    expect((await previa.GET(new Request(`${BASE}/api/codigos/${id}/previa`), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect((await imagem.GET(new Request(`${BASE}/api/codigos/${id}/imagem/logo`), { params: Promise.resolve({ id, tipo: "logo" }) })).status).toBe(401);
    for (const tipo of ["logo", "fundo", "../../etc"]) {
      const r = await publica.GET(new Request(`${BASE}/q/${codigo.token}/img/${tipo}`), { params: Promise.resolve({ token: codigo.token, tipo }) });
      expect(r.status).toBe(404);
    }
  });

  it("job de retenção exige o segredo do cron", async () => {
    const cron = await import("@/app/api/cron/retencao/route");
    process.env.CRON_SECRET = "segredo-do-cron-1234567890";
    expect((await cron.GET(new Request(`${BASE}/api/cron/retencao`))).status).toBe(401);
    expect((await cron.GET(new Request(`${BASE}/api/cron/retencao`, { headers: { authorization: "Bearer errado" } }))).status).toBe(401);
    expect((await cron.GET(new Request(`${BASE}/api/cron/retencao`, { headers: { authorization: "Bearer segredo-do-cron-1234567890" } }))).status).toBe(200);
    process.env.CRON_SECRET = "";
    expect((await cron.GET(new Request(`${BASE}/api/cron/retencao`, { headers: { authorization: "Bearer " } }))).status).toBe(401);
  });

  it("conhecer o QR não dá acesso de edição: a rota pública só aceita leitura", async () => {
    const rota = (await import("@/app/q/[token]/route")) as Record<string, unknown>;
    expect(Object.keys(rota).filter((k) => ["POST", "PUT", "PATCH", "DELETE"].includes(k))).toEqual([]);
  });
});

describe("autenticado", () => {
  it("a mesma action funciona com sessão válida, e os downloads saem com auditoria", async () => {
    estado.cookie = sessao;
    const acoes = await import("@/app/(painel)/acoes");
    const r = await acoes.acaoConfigurar({ tipo: "inicial" }, formulario({
      id: String(codigo.id), destino: "https://loja.exemplo.com/", cliente: "Loja", notas: "", confirmarAvisos: "on",
    }));
    expect(r).toEqual({ tipo: "salvo", modo: "LINK", destino: "https://loja.exemplo.com/" });

    const png = await import("@/app/api/codigos/[id]/png/route");
    const lote = await import("@/app/api/lotes/[id]/[formato]/route");
    const cabecalho = { headers: { cookie: `iqr_sessao=${sessao}` } };
    const r1 = await png.GET(new Request(`${BASE}/api/codigos/${codigo.id}/png?legenda=1`, cabecalho), { params: Promise.resolve({ id: String(codigo.id) }) });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("content-type")).toBe("image/png");
    expect(r1.headers.get("content-disposition")).toMatch(/attachment; filename="IQ-\d{6}_\w{6}\.png"/);
    const { decodificarPng } = await import("@/lib/qr");
    expect(decodificarPng(new Uint8Array(await r1.arrayBuffer()))).toBe(`${BASE}/q/${codigo.token}`);

    const assinaturas = { zip: "PK", pdf: "%PDF", csv: "﻿numero" };
    for (const [formato, inicio] of Object.entries(assinaturas)) {
      const r = await lote.GET(new Request(`${BASE}/api/lotes/${loteId}/${formato}`, cabecalho), { params: Promise.resolve({ id: String(loteId), formato }) });
      expect(r.status).toBe(200);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(new TextDecoder().decode((await r.arrayBuffer()).slice(0, 12))).toContain(inicio.replace("﻿", ""));
    }
    const exportacoes = await db.query<{ meta: { formato: string } }>("select meta from auditoria where acao = 'EXPORTACAO'");
    expect(exportacoes.rows.map((e) => e.meta.formato).sort()).toEqual(["csv", "pdf", "png", "zip"]);
  });
});

describe("página de links pelas rotas reais", () => {
  it("admin envia logo, salva a página e o QR do segundo código abre a página com a imagem pública", async () => {
    estado.cookie = sessao;
    const acoes = await import("@/app/(painel)/acoes");
    const outro = (await codigosDoLote(db, loteId))[1]!;
    const { gerarPng } = await import("@/lib/qr");
    const png = gerarPng("https://exemplo.com");

    const svg = formulario({ id: String(outro.id), tipo: "logo" });
    svg.set("arquivo", new File(["<svg onload=alert(1)>"], "logo.png", { type: "image/png" }));
    expect((await acoes.acaoImagem({}, svg)).erro).toContain("Formato não aceito");

    const envio = formulario({ id: String(outro.id), tipo: "logo" });
    envio.set("arquivo", new File([new Uint8Array(png)], "logo.png", { type: "image/png" }));
    expect(await acoes.acaoImagem({}, envio)).toEqual({ ok: "Logo salva." });

    const fd = formulario({
      id: String(outro.id), modo: "PAGINA", destino: "", cliente: "", notas: "", confirmarAvisos: "on",
      p_titulo: "Loja Dois", p_subtitulo: "", p_subtitulo_url: "", p_rodape: "", p_cor_fundo: "#ffffff", p_cor_destaque: "#ff0066",
    });
    for (const [rotulo, url, icone] of [["Site", "https://loja.exemplo.com/a", "site"], ["Insta", "https://instagram.com/lojadois", "instagram"]]) {
      fd.append("link_rotulo", rotulo!); fd.append("link_url", url!); fd.append("link_icone", icone!);
    }
    expect(await acoes.acaoConfigurar({ tipo: "inicial" }, fd)).toEqual({ tipo: "salvo", modo: "PAGINA", destino: null });

    const { GET } = await import("@/app/q/[token]/route");
    const r = await GET(new Request(`${BASE}/q/${outro.token}`, { headers: { "x-forwarded-for": "5.5.5.5" } }), { params: Promise.resolve({ token: outro.token }) });
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain("Loja Dois");
    expect(html.match(/class="link"/g)).toHaveLength(2);

    const publica = await import("@/app/q/[token]/img/[tipo]/route");
    const img = await publica.GET(new Request(`${BASE}/q/${outro.token}/img/logo`), { params: Promise.resolve({ token: outro.token, tipo: "logo" }) });
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await img.arrayBuffer()).equals(png)).toBe(true);
    const semFundo = await publica.GET(new Request(`${BASE}/q/${outro.token}/img/fundo`), { params: Promise.resolve({ token: outro.token, tipo: "fundo" }) });
    expect(semFundo.status).toBe(404);

    const previa = await import("@/app/api/codigos/[id]/previa/route");
    const p = await previa.GET(new Request(`${BASE}/api/codigos/${outro.id}/previa`, { headers: { cookie: `iqr_sessao=${sessao}` } }), { params: Promise.resolve({ id: String(outro.id) }) });
    expect(p.status).toBe(200);
    expect(await p.text()).toContain(`/api/codigos/${outro.id}/imagem/logo`);
  });
});

describe("rota pública /q/[token]", () => {
  it("redireciona com 302 e limita requisições por IP", async () => {
    const { GET } = await import("@/app/q/[token]/route");
    const ler = (ip: string) =>
      GET(new Request(`${BASE}/q/${codigo.token}`, { headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ token: codigo.token }) });

    const primeira = await ler("9.9.9.9");
    expect(primeira.status).toBe(302);
    expect(primeira.headers.get("location")).toBe("https://loja.exemplo.com/");

    const respostas = [];
    for (let i = 0; i < 70; i++) respostas.push((await ler("8.8.8.8")).status);
    expect(respostas.slice(0, 60).every((s) => s === 302)).toBe(true);
    expect(respostas.slice(60).every((s) => s === 429)).toBe(true);
    expect((await ler("7.7.7.7")).status).toBe(302);
  });

  it("sem SESSION_SECRET ou banco, responde 503 genérico em vez de estourar", async () => {
    const { GET } = await import("@/app/q/[token]/route");
    const guardado = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "";
    const r = await GET(new Request(`${BASE}/q/${codigo.token}`), { params: Promise.resolve({ token: codigo.token }) });
    process.env.SESSION_SECRET = guardado;
    expect(r.status).toBe(503);
  });
});
