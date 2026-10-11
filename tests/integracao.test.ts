import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { historicoDoCodigo, listarAuditoria } from "@/lib/auditoria";
import {
  configurarCodigo, contagens, ErroDeNegocio, listarCodigos, obterCodigo, operarCodigo, registrarAcesso,
} from "@/lib/codigos";
import type { Db } from "@/lib/db";
import { gerarCsv, gerarPdf, gerarZip, nomeDoArquivo } from "@/lib/exportar";
import { consumirLimite } from "@/lib/limite";
import { entrar, LIMITE_LOGIN } from "@/lib/login";
import { codigosDoLote, gerarLote, listarLotes } from "@/lib/lotes";
import { atenderLeitura } from "@/lib/publico";
import { decodificarPng } from "@/lib/qr";
import { aplicarRetencao } from "@/lib/retencao";
import { validarSessao } from "@/lib/sessao";
import { FORMATO_TOKEN, formatarNumero, urlPublica } from "@/lib/token";
import { BASE, criarBanco, SENHA } from "./apoio";

let db: Db;
let admin: { id: number };
let fechar: () => Promise<void>;

beforeAll(async () => {
  ({ db, admin, fechar } = await criarBanco());
});
afterAll(() => fechar());

/** "Lê o QR": decodifica o PNG e faz o GET na URL lida, como um celular faria. */
async function escanear(png: Uint8Array) {
  const lido = decodificarPng(png);
  expect(lido).toMatch(new RegExp(`^${BASE}/q/`));
  const token = new URL(lido!).pathname.split("/").pop()!;
  return { lido: lido!, resposta: await atenderLeitura(db, token) };
}
const confirmar = { confirmarAvisos: true, confirmarReassociacao: true };
const config = (destino: string, cliente = "", notas = "") => ({ destino, cliente, notas });

describe("cenário principal: 10 códigos, Loja A → Loja B sem reimprimir", () => {
  let itens: Awaited<ReturnType<typeof codigosDoLote>>;
  let zip: Record<string, Uint8Array>;
  let loteId: number;

  it("gera 10 códigos com tokens únicos, números de inventário únicos e status disponível", async () => {
    const lote = await gerarLote(db, { quantidade: 10, nome: "Piloto" }, admin, BASE);
    loteId = lote.id;
    expect(lote.status).toBe("PRONTO");
    itens = await codigosDoLote(db, lote.id);
    expect(itens).toHaveLength(10);
    expect(new Set(itens.map((i) => i.token)).size).toBe(10);
    expect(new Set(itens.map((i) => i.numero)).size).toBe(10);
    expect(itens.every((i) => FORMATO_TOKEN.test(i.token) && i.status === "DISPONIVEL")).toBe(true);
    // O token não contém o número de inventário.
    expect(itens.some((i) => i.token.includes(String(i.numero).padStart(3, "0")))).toBe(false);
  });

  it("exporta ZIP: um PNG por código, nomeado pelo inventário, decodificando para a URL salva", () => {
    zip = unzipSync(gerarZip(itens, BASE, true));
    expect(Object.keys(zip).sort()).toEqual(itens.map(nomeDoArquivo).sort());
    for (const item of itens) {
      expect(nomeDoArquivo(item)).toMatch(/^IQ-\d{6}_[A-Za-z0-9]{6}\.png$/);
      expect(decodificarPng(zip[nomeDoArquivo(item)]!)).toBe(urlPublica(BASE, item.token));
    }
  });

  it("exporta PDF A4 com páginas de códigos e página de conferência, e CSV sem segredos", async () => {
    const A4 = [595.28, 841.89];
    for (const [layout, paginas] of [["grade", 2], ["etiquetas", 2], ["plaquinha", 11]] as const) {
      const pdf = await PDFDocument.load(await gerarPdf(itens, BASE, { layout, comLegenda: true, comGuias: true, lote: "Piloto" }));
      expect(pdf.getPageCount()).toBe(paginas);
      for (const pagina of pdf.getPages()) {
        expect(pagina.getWidth()).toBeCloseTo(A4[0]!, 1);
        expect(pagina.getHeight()).toBeCloseTo(A4[1]!, 1);
      }
    }
    const csv = gerarCsv(itens, BASE, "Piloto");
    expect(csv.trim().split("\r\n")).toHaveLength(11);
    for (const item of itens) expect(csv).toContain(urlPublica(BASE, item.token));
    expect(csv).not.toMatch(/senha|notas|cliente|destino/i);
  });

  it("código ainda não configurado mostra a página da Infuse com o nº de inventário, sem redirecionar nem contar acesso", async () => {
    const { resposta } = await escanear(zip[nomeDoArquivo(itens[0]!)]!);
    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("location")).toBeNull();
    expect(resposta.headers.get("cache-control")).toContain("no-store");
    const html = await resposta.text();
    expect(html).toContain("Infuse Software");
    expect(html).toContain("Pagar via Pix");
    expect(html).toContain(formatarNumero(itens[0]!.numero));
    expect(html).not.toContain(formatarNumero(itens[1]!.numero));
    expect((await obterCodigo(db, itens[0]!.id))!.acessos).toBe(0);
  });

  it("configura o código 1 para a Loja A; ler o QR leva à Loja A com 302 sem cache", async () => {
    const r = await configurarCodigo(db, itens[0]!.id, { ...config("https://loja-a.exemplo.com/pix", "Loja A"), ...confirmar }, admin);
    expect(r.tipo).toBe("salvo");
    const { resposta } = await escanear(zip[nomeDoArquivo(itens[0]!)]!);
    expect(resposta.status).toBe(302);
    expect(resposta.headers.get("location")).toBe("https://loja-a.exemplo.com/pix");
    expect(resposta.headers.get("cache-control")).toContain("no-store");
  });

  it("muda o destino para a Loja B; exatamente o mesmo QR leva à Loja B", async () => {
    const antes = await obterCodigo(db, itens[0]!.id);
    const r = await configurarCodigo(db, itens[0]!.id, { ...config("https://loja-b.exemplo.com/pagar", "Loja B"), ...confirmar }, admin);
    expect(r.tipo).toBe("salvo");
    const depois = await obterCodigo(db, itens[0]!.id);
    expect(depois!.token).toBe(antes!.token);
    expect(depois!.numero).toBe(antes!.numero);

    const { lido, resposta } = await escanear(zip[nomeDoArquivo(itens[0]!)]!);
    expect(lido).toBe(urlPublica(BASE, antes!.token));
    expect(resposta.status).toBe(302);
    expect(resposta.headers.get("location")).toBe("https://loja-b.exemplo.com/pagar");
    // Um PNG gerado agora é idêntico ao que já foi "impresso".
    const novoZip = unzipSync(gerarZip(itens, BASE, true));
    expect(Buffer.from(novoZip[nomeDoArquivo(itens[0]!)]!).equals(Buffer.from(zip[nomeDoArquivo(itens[0]!)]!))).toBe(true);
  });

  it("os outros 9 códigos continuam sem destino", async () => {
    for (const item of itens.slice(1)) {
      const { resposta } = await escanear(zip[nomeDoArquivo(item)]!);
      expect(resposta.status).toBe(200);
      expect(resposta.headers.get("location")).toBeNull();
    }
    expect((await contagens(db)).CONFIGURADO).toBe(1);
    expect((await contagens(db)).DISPONIVEL).toBe(9);
    expect(loteId).toBeGreaterThan(0);
  });
});

describe("redirecionamento público", () => {
  let id: number;
  let token: string;
  beforeAll(async () => {
    const lote = await gerarLote(db, { quantidade: 1 }, admin, BASE);
    ({ id, token } = (await codigosDoLote(db, lote.id))[0]!);
    await configurarCodigo(db, id, { ...config("https://antigo.exemplo.com/segredo?k=1", "Cliente Secreto", "nota interna"), ...confirmar }, admin);
  });

  it("token inexistente ou malformado cai no mesmo fallback, sem consultar destino", async () => {
    for (const t of ["AAAAAAAAAAAA", "001", "../admin", "a".repeat(500), "'; drop table codigos;--"]) {
      const r = await atenderLeitura(db, t);
      expect(r.status).toBe(404);
      expect(r.headers.get("location")).toBeNull();
    }
  });

  it("código desativado não redireciona nem revela destino, cliente ou notas; reativar restaura", async () => {
    await operarCodigo(db, id, "desativar", admin, true);
    const r = await atenderLeitura(db, token);
    const html = await r.text();
    expect(r.status).toBe(404);
    expect(r.headers.get("location")).toBeNull();
    for (const segredo of ["antigo.exemplo.com", "Cliente Secreto", "nota interna", token]) expect(html).not.toContain(segredo);

    await operarCodigo(db, id, "reativar", admin, false);
    expect((await atenderLeitura(db, token)).headers.get("location")).toBe("https://antigo.exemplo.com/segredo?k=1");
  });

  it("fallback é idêntico para inexistente, desativado e arquivado", async () => {
    const inexistente = await (await atenderLeitura(db, "AAAAAAAAAAAA")).text();
    await operarCodigo(db, id, "arquivar", admin, true);
    expect(await (await atenderLeitura(db, token)).text()).toBe(inexistente);
    await operarCodigo(db, id, "desarquivar", admin, false);
    expect((await obterCodigo(db, id))!.status).toBe("DESATIVADO");
    expect(await (await atenderLeitura(db, token)).text()).toBe(inexistente);
    await operarCodigo(db, id, "reativar", admin, false);
  });

  it("conta acessos de forma agregada, e falha na estatística não impede o redirecionamento", async () => {
    const tarefas: (() => Promise<void>)[] = [];
    const r = await atenderLeitura(db, token, { adiar: (t) => tarefas.push(t) });
    expect(r.status).toBe(302);
    const antes = (await obterCodigo(db, id))!.acessos;
    await Promise.all(tarefas.map((t) => t()));
    expect((await obterCodigo(db, id))!.acessos).toBe(antes + 1);
    const horas = await db.query<{ total: number }>("select total from acessos_hora where codigo_id = $1", [id]);
    expect(horas.rows).toHaveLength(1);
    const colunas = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'acessos_hora'");
    expect(colunas.rows.map((c) => c.column_name).sort()).toEqual(["codigo_id", "hora", "total"]);

    // Estatística quebrada: o redirecionamento sai do mesmo jeito.
    const quebrado: Db = {
      ...db,
      query: ((sql: string, p?: unknown[]) =>
        /acessos/.test(sql) && !/^select/.test(sql) ? Promise.reject(new Error("falhou")) : db.query(sql, p)) as Db["query"],
    };
    expect((await atenderLeitura(quebrado, token)).status).toBe(302);
    expect((await atenderLeitura(db, token, { adiar: () => { throw new Error("sem contexto"); } })).status).toBe(302);
  });

  it("banco fora do ar vira 503 genérico, sem stack trace", async () => {
    const fora: Db = { ...db, query: () => Promise.reject(new Error("ECONNREFUSED 10.0.0.5:5432")) };
    const r = await atenderLeitura(fora, token);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|Error/);
  });

  it("destino salvo que deixa de passar na política atual para de redirecionar", async () => {
    expect((await atenderLeitura(db, token, { hostsPermitidos: ["outro.com"] })).status).toBe(404);
    await db.query("update codigos set destino = 'javascript:alert(1)' where id = $1", [id]);
    expect((await atenderLeitura(db, token)).status).toBe(404);
  });
});

describe("configuração, estados e reassociação", () => {
  let id: number;
  beforeAll(async () => {
    const lote = await gerarLote(db, { quantidade: 3, nome: "Regras" }, admin, BASE);
    id = (await codigosDoLote(db, lote.id))[0]!.id;
  });

  it("recusa destino inválido sem alterar o registro", async () => {
    for (const ruim of ["javascript:alert(1)", "http://exemplo.com", "https://u:p@exemplo.com"]) {
      expect((await configurarCodigo(db, id, config(ruim), admin)).tipo).toBe("erro");
    }
    const c = (await obterCodigo(db, id))!;
    expect(c.status).toBe("DISPONIVEL");
    expect(c.destino).toBeNull();
  });

  it("domínio novo exige confirmação antes de salvar", async () => {
    const pendente = await configurarCodigo(db, id, config("https://dominio-novo.exemplo.org/x", "Padaria"), admin);
    expect(pendente).toMatchObject({ tipo: "confirmar", reassociacao: false });
    expect((await obterCodigo(db, id))!.destino).toBeNull();
    const salvo = await configurarCodigo(db, id, { ...config("https://dominio-novo.exemplo.org/x", "Padaria"), confirmarAvisos: true }, admin);
    expect(salvo.tipo).toBe("salvo");
    expect((await obterCodigo(db, id))!).toMatchObject({ status: "CONFIGURADO", cliente: "Padaria" });
  });

  it("trocar o cliente de um código já associado exige confirmação explícita e fica no histórico", async () => {
    const pendente = await configurarCodigo(db, id, config("https://dominio-novo.exemplo.org/x", "Outra Loja"), admin);
    expect(pendente).toMatchObject({ tipo: "confirmar", reassociacao: true });
    expect((await obterCodigo(db, id))!.cliente).toBe("Padaria");
    await configurarCodigo(db, id, { ...config("https://dominio-novo.exemplo.org/x", "Outra Loja"), confirmarReassociacao: true }, admin);
    expect((await obterCodigo(db, id))!.cliente).toBe("Outra Loja");
    expect((await historicoDoCodigo(db, id)).map((h) => h.acao)).toContain("REASSOCIADO");
  });

  it("operações destrutivas sem confirmação são recusadas", async () => {
    for (const op of ["desativar", "arquivar", "limpar-dados"] as const) {
      await expect(operarCodigo(db, id, op, admin, false)).rejects.toBeInstanceOf(ErroDeNegocio);
    }
    expect((await obterCodigo(db, id))!.status).toBe("CONFIGURADO");
  });

  it("editar um código desativado não o religa; arquivado não aceita configuração", async () => {
    await operarCodigo(db, id, "desativar", admin, true);
    await configurarCodigo(db, id, { ...config("https://dominio-novo.exemplo.org/y", "Outra Loja"), ...confirmar }, admin);
    expect((await obterCodigo(db, id))!.status).toBe("DESATIVADO");
    await operarCodigo(db, id, "arquivar", admin, true);
    expect((await configurarCodigo(db, id, { ...config("https://dominio-novo.exemplo.org/z"), ...confirmar }, admin)).tipo).toBe("erro");
    await operarCodigo(db, id, "desarquivar", admin, false);
    await operarCodigo(db, id, "reativar", admin, false);
    expect((await obterCodigo(db, id))!.status).toBe("CONFIGURADO");
  });

  it("remover dados do cliente apaga nome, notas e destino, mantém a auditoria sem esses dados", async () => {
    const eventosAntes = (await historicoDoCodigo(db, id)).length;
    const c = await operarCodigo(db, id, "limpar-dados", admin, true);
    expect(c).toMatchObject({ status: "DISPONIVEL", destino: null, cliente: null, notas: null });
    const historico = await historicoDoCodigo(db, id);
    expect(historico.length).toBe(eventosAntes + 1);
    expect(JSON.stringify(historico)).not.toMatch(/dominio-novo|Padaria|Outra Loja/);
  });

  it("busca por número de inventário, cliente, lote e status, com paginação", async () => {
    const lote = (await listarLotes(db)).find((l) => l.nome === "Regras")!;
    const doLote = await codigosDoLote(db, lote.id);
    await configurarCodigo(db, doLote[1]!.id, { ...config("https://dominio-novo.exemplo.org/a", "Mercado 100%_Bom"), ...confirmar }, admin);

    expect((await listarCodigos(db, { q: `IQ-${String(doLote[1]!.numero).padStart(6, "0")}` })).itens[0]!.id).toBe(doLote[1]!.id);
    expect((await listarCodigos(db, { q: String(doLote[2]!.numero) })).itens.map((i) => i.id)).toContain(doLote[2]!.id);
    expect((await listarCodigos(db, { q: "mercado 100%_bom" })).total).toBe(1);
    expect((await listarCodigos(db, { q: "%" })).total).toBe(1); // curinga é tratado como texto
    expect((await listarCodigos(db, { q: "regras" })).total).toBe(3);
    expect((await listarCodigos(db, { loteId: lote.id, status: "DISPONIVEL" })).total).toBe(2);
    const pagina = await listarCodigos(db, { pagina: 2, porPagina: 5 });
    expect(pagina.itens).toHaveLength(5);
    expect(pagina.total).toBeGreaterThanOrEqual(14);
  });
});

describe("geração de lotes", () => {
  it("valida quantidade e nome", async () => {
    for (const q of [0, -1, 1.5, 501, Number.NaN]) {
      await expect(gerarLote(db, { quantidade: q }, admin, BASE)).rejects.toBeInstanceOf(ErroDeNegocio);
    }
    await expect(gerarLote(db, { quantidade: 1, nome: "<script>" }, admin, BASE)).rejects.toBeInstanceOf(ErroDeNegocio);
  });

  it("se a conferência falha, nenhum código é criado e o lote fica registrado como erro", async () => {
    const antes = (await listarCodigos(db)).total;
    await expect(
      gerarLote(db, { quantidade: 5, nome: "Falha" }, admin, BASE, { decodificar: () => "https://outro.test/q/x" }),
    ).rejects.toThrow(/nenhum código deste lote foi criado/);
    expect((await listarCodigos(db)).total).toBe(antes);
    const lote = (await listarLotes(db)).find((l) => l.nome === "Falha")!;
    expect(lote.status).toBe("ERRO");
    expect(await codigosDoLote(db, lote.id)).toHaveLength(0);
    expect((await contagens(db)).lotesComErro).toBe(1);
  });

  it("colisão de token não cria lote parcial: refaz com tokens novos", async () => {
    const existente = (await listarCodigos(db)).itens[0]!.token;
    let chamadas = 0;
    const lote = await gerarLote(db, { quantidade: 2, nome: "Colisao" }, admin, BASE, {
      gerarTokens: () => (chamadas++ === 0 ? [existente, "ZZZZZZZZZZZ2"] : ["ZZZZZZZZZZZ3", "ZZZZZZZZZZZ4"]),
    });
    expect(chamadas).toBe(2);
    expect((await codigosDoLote(db, lote.id)).map((c) => c.token).sort()).toEqual(["ZZZZZZZZZZZ3", "ZZZZZZZZZZZ4"]);
    expect((await listarLotes(db)).filter((l) => l.nome === "Colisao")).toHaveLength(1);
  });

  it("o banco impede token ou número de inventário repetido e CONFIGURADO sem destino", async () => {
    const c = (await listarCodigos(db)).itens[0]!;
    await expect(db.query("insert into codigos (token, lote_id) values ($1, $2)", [c.token, c.lote_id])).rejects.toThrow();
    await expect(db.query("insert into codigos (token, numero, lote_id) values ('YYYYYYYYYYYY', $1, $2)", [c.numero, c.lote_id])).rejects.toThrow();
    await expect(db.query("update codigos set status = 'CONFIGURADO', destino = null where id = $1", [c.id])).rejects.toThrow();
  });

  it("gera o limite de 500 códigos conferidos numa única transação", async () => {
    const lote = await gerarLote(db, { quantidade: 500, nome: "Grande" }, admin, BASE);
    expect(await codigosDoLote(db, lote.id)).toHaveLength(500);
  });
});

describe("login, sessão e rate limiting", () => {
  const segredo = "s".repeat(40);
  it("entra com a senha certa, recusa a errada com a mesma mensagem de usuário inexistente", async () => {
    const ok = await entrar(db, { usuario: " Admin ", senha: SENHA, ip: "1.1.1.1", segredo });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((await validarSessao(db, ok.token))?.usuario).toBe("admin");
    const errada = await entrar(db, { usuario: "admin", senha: "errada", ip: "1.1.1.2", segredo });
    const inexistente = await entrar(db, { usuario: "ninguem", senha: "errada", ip: "1.1.1.3", segredo });
    expect(errada).toEqual({ ok: false, erro: "Usuário ou senha incorretos." });
    expect(inexistente).toEqual(errada);
  });

  it("sessão inválida, expirada ou de admin desativado não vale; o banco guarda só o hash do token", async () => {
    expect(await validarSessao(db, "token-inventado")).toBeNull();
    expect(await validarSessao(db, undefined)).toBeNull();
    const r = await entrar(db, { usuario: "admin", senha: SENHA, ip: "2.2.2.2", segredo });
    if (!r.ok) throw new Error("login falhou");
    const salvo = await db.query<{ token_hash: string }>("select token_hash from sessoes");
    expect(salvo.rows.some((s) => s.token_hash === r.token)).toBe(false);
    await db.query("update admins set ativo = false");
    expect(await validarSessao(db, r.token)).toBeNull();
    await db.query("update admins set ativo = true");
    await db.query("update sessoes set expira_em = now() - interval '1 minute'");
    expect(await validarSessao(db, r.token)).toBeNull();
  });

  it("bloqueia força bruta por usuário, mesmo com a senha certa depois do limite", async () => {
    const usuario = "alvo";
    for (let i = 0; i < LIMITE_LOGIN.porUsuario; i++) {
      expect((await entrar(db, { usuario, senha: "x", ip: `3.3.3.${i}`, segredo })).ok).toBe(false);
    }
    const bloqueado = await entrar(db, { usuario, senha: "x", ip: "3.3.3.200", segredo });
    expect(bloqueado).toMatchObject({ ok: false, erro: expect.stringContaining("Muitas tentativas") });
  });

  it("limite persistido: conta por chave e por janela, sem guardar IP em claro", async () => {
    const t0 = new Date("2026-01-01T00:00:10Z");
    expect(await consumirLimite(db, "teste:a", 2, 60, t0)).toBe(true);
    expect(await consumirLimite(db, "teste:a", 2, 60, t0)).toBe(true);
    expect(await consumirLimite(db, "teste:a", 2, 60, t0)).toBe(false);
    expect(await consumirLimite(db, "teste:b", 2, 60, t0)).toBe(true);
    expect(await consumirLimite(db, "teste:a", 2, 60, new Date("2026-01-01T00:01:10Z"))).toBe(true);
    const chaves = await db.query<{ chave: string }>("select chave from limites");
    expect(chaves.rows.some((c) => /\d+\.\d+\.\d+\.\d+|@/.test(c.chave))).toBe(false);
  });
});

describe("auditoria e retenção", () => {
  it("registra criação, destino, associação, desativação, reativação e exportação com ator e horário", async () => {
    const lote = await gerarLote(db, { quantidade: 1, nome: "Auditado" }, admin, BASE);
    const { id } = (await codigosDoLote(db, lote.id))[0]!;
    await configurarCodigo(db, id, { ...config("https://dominio-novo.exemplo.org/k?token=abc", "Cliente X", "obs"), ...confirmar }, admin);
    await operarCodigo(db, id, "desativar", admin, true);
    await operarCodigo(db, id, "reativar", admin, false);
    const h = await historicoDoCodigo(db, id);
    expect(h.map((e) => e.acao).sort()).toEqual(
      ["CLIENTE_ASSOCIADO", "CODIGO_CRIADO", "DESATIVADO", "DESTINO_ALTERADO", "NOTAS_ALTERADAS", "REATIVADO"]);
    expect(h.every((e) => e.admin_usuario === "admin" && e.em instanceof Date)).toBe(true);
    // Metadados mínimos: só o host, nunca a URL completa, o cliente ou as notas.
    expect(JSON.stringify(h)).not.toMatch(/token=abc|Cliente X|obs"/);
    expect(h.find((e) => e.acao === "DESTINO_ALTERADO")!.meta).toEqual({ de_host: null, para_host: "dominio-novo.exemplo.org" });
    expect((await listarAuditoria(db, 1)).itens.some((e) => e.acao === "LOTE_CRIADO" && e.lote_id === lote.id)).toBe(true);
  });

  it("retenção apaga sessões vencidas, limites antigos e registros além do prazo", async () => {
    const { id } = (await listarCodigos(db)).itens[0]!;
    await registrarAcesso(db, id);
    await db.query("insert into acessos_hora (codigo_id, hora, total) values ($1, now() - interval '200 days', 3)", [id]);
    await db.query("insert into auditoria (acao, em) values ('LOGIN', now() - interval '900 days')");
    const r = await aplicarRetencao(db, { acessosDias: 90, auditoriaDias: 730 });
    expect(r.acessos).toBe(1);
    expect(r.auditoria).toBe(1);
    expect(r.sessoes).toBeGreaterThanOrEqual(1);
    expect(r.limites).toBeGreaterThanOrEqual(1);
  });
});
