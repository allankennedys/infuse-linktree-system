import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { historicoDoCodigo } from "@/lib/auditoria";
import { codigosDoGerente, configurarCodigo, obterCodigo, operarCodigo } from "@/lib/codigos";
import type { Db } from "@/lib/db";
import {
  definirGerente, removerGerente, trocarSenhaDoGerente, validarSessaoGerente,
} from "@/lib/gerentes";
import { trocarImagem } from "@/lib/imagem-acao";
import { entrar } from "@/lib/login";
import { codigosDoLote, gerarLote } from "@/lib/lotes";
import { obterImagem, obterPagina } from "@/lib/pagina";
import { aplicarRetencao } from "@/lib/retencao";
import { validarSessao } from "@/lib/sessao";
import { BASE, criarBanco, SENHA } from "./apoio";

let db: Db;
let admin: { id: number };
let fechar: () => Promise<void>;
let a: number, b: number, c: number;

const SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";
const login = (usuario: string, senha: string) => entrar(db, { usuario, senha, ip: "203.0.113.9", segredo: SEGREDO });
const pagina = {
  titulo: "Padaria do Zé", subtitulo: "", subtitulo_url: "", rodape: "", cor_fundo: "#102030", cor_destaque: "#ffaa00",
  links: [{ rotulo: "Cardápio", url: "https://padaria.exemplo.com/cardapio", icone: "cardapio" }],
};
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const envio = () => {
  const fd = new FormData();
  fd.set("tipo", "logo");
  fd.set("arquivo", new File([png], "logo.png"));
  return fd;
};

beforeAll(async () => {
  ({ db, admin, fechar } = await criarBanco());
  const lote = await gerarLote(db, { quantidade: 3 }, admin, BASE);
  [a, b, c] = (await codigosDoLote(db, lote.id)).map((x) => x.id) as [number, number, number];
  await configurarCodigo(db, a, { destino: "", cliente: "Padaria", notas: "interno", modo: "LINK" }, admin);
});
afterAll(() => fechar());

describe("acesso do cliente (gerente) a um código", () => {
  it("o admin cria o usuário do cliente no código; usuário inválido, senha curta e nome de admin são recusados", async () => {
    await expect(definirGerente(db, a, { usuario: "Zé da Padaria", senha: "senha-boa-123" }, admin)).rejects.toThrow(/Usuário/);
    await expect(definirGerente(db, a, { usuario: "padaria", senha: "curta" }, admin)).rejects.toThrow(/mínimo/);
    await expect(definirGerente(db, a, { usuario: "padaria", senha: "" }, admin)).rejects.toThrow(/senha/i);
    await expect(definirGerente(db, a, { usuario: "admin", senha: "senha-boa-123" }, admin)).rejects.toThrow(/administrador/);

    const g = await definirGerente(db, a, { usuario: " Padaria ", senha: "senha-boa-123" }, admin);
    expect(g.usuario).toBe("padaria");
    expect((await obterCodigo(db, a))!.gerente_usuario).toBe("padaria");
    expect(JSON.stringify(await historicoDoCodigo(db, a))).not.toContain("senha-boa-123");
  });

  it("o mesmo usuário pode gerenciar outro código sem informar a senha de novo", async () => {
    await definirGerente(db, b, { usuario: "padaria", senha: "" }, admin);
    const g = (await obterCodigo(db, a))!.gerente_id!;
    expect((await codigosDoGerente(db, g)).map((x) => x.id)).toEqual([a, b]);
  });

  it("o login do cliente abre sessão de gerente, que não vale como sessão de administrador", async () => {
    expect(await login("padaria", "senha-errada")).toMatchObject({ ok: false });
    const r = await login("PADARIA", "senha-boa-123");
    expect(r).toMatchObject({ ok: true, tipo: "gerente" });
    if (!r.ok) return;
    expect(await validarSessaoGerente(db, r.token)).toMatchObject({ usuario: "padaria" });
    expect(await validarSessao(db, r.token)).toBeNull();

    const adm = await login("admin", SENHA);
    expect(adm).toMatchObject({ ok: true, tipo: "admin" });
    if (adm.ok) expect(await validarSessaoGerente(db, adm.token)).toBeNull();
  });

  it("o gerente edita o conteúdo do código dele, sem tocar nos campos internos", async () => {
    const gerenteId = (await obterCodigo(db, a))!.gerente_id!;
    const r = await configurarCodigo(
      db, a, { destino: "", cliente: "Outro nome", notas: "apaguei", modo: "PAGINA", pagina, confirmarAvisos: true }, { gerenteId });
    expect(r.tipo).toBe("salvo");
    const depois = (await obterCodigo(db, a))!;
    expect(depois).toMatchObject({ status: "CONFIGURADO", modo: "PAGINA", cliente: "Padaria", notas: "interno" });
    expect((await obterPagina(db, a))!.links).toHaveLength(1);

    expect(await trocarImagem(db, a, envio(), { gerenteId })).toMatchObject({ ok: "Logo salva." });
    expect(await obterImagem(db, a, "logo")).not.toBeNull();

    const autores = (await historicoDoCodigo(db, a)).filter((h) => h.acao === "PAGINA_ALTERADA" || h.acao === "IMAGEM_ALTERADA");
    expect(autores.length).toBe(2);
    expect(autores.every((h) => h.gerente_usuario === "padaria" && h.admin_usuario === null)).toBe(true);
  });

  it("o gerente não consegue editar código de outro cliente nem código sem gerente", async () => {
    await definirGerente(db, c, { usuario: "mercado", senha: "outra-senha-456" }, admin);
    const padaria = (await obterCodigo(db, a))!.gerente_id!;
    await expect(configurarCodigo(db, c, { destino: "https://exemplo.com/", cliente: "", notas: "", modo: "LINK" }, { gerenteId: padaria }))
      .rejects.toThrow("Código não encontrado.");
    expect(await trocarImagem(db, c, envio(), { gerenteId: padaria })).toEqual({ erro: "Código não encontrado." });
    expect((await obterCodigo(db, c))!.destino).toBeNull();
    expect(await obterImagem(db, c, "logo")).toBeNull();
  });

  it("código arquivado sai da lista do gerente e não aceita edição dele", async () => {
    const mercado = (await obterCodigo(db, c))!.gerente_id!;
    await operarCodigo(db, c, "arquivar", admin, true);
    expect(await codigosDoGerente(db, mercado)).toEqual([]);
    const r = await configurarCodigo(db, c, { destino: "https://exemplo.com/", cliente: "", notas: "", modo: "LINK" }, { gerenteId: mercado });
    expect(r).toMatchObject({ tipo: "erro" });
  });

  it("o cliente troca a própria senha; a antiga deixa de valer e as outras sessões caem", async () => {
    const gerenteId = (await obterCodigo(db, a))!.gerente_id!;
    const outra = await login("padaria", "senha-boa-123");
    const esta = await login("padaria", "senha-boa-123");
    if (!outra.ok || !esta.ok) throw new Error("login falhou");
    await expect(trocarSenhaDoGerente(db, gerenteId, "errada", "nova-senha-789")).rejects.toThrow(/não confere/);
    await expect(trocarSenhaDoGerente(db, gerenteId, "senha-boa-123", "curta")).rejects.toThrow(/pelo menos/);
    await trocarSenhaDoGerente(db, gerenteId, "senha-boa-123", "nova-senha-789", esta.token);
    expect(await validarSessaoGerente(db, esta.token)).not.toBeNull();
    expect(await validarSessaoGerente(db, outra.token)).toBeNull();
    expect(await login("padaria", "senha-boa-123")).toMatchObject({ ok: false });
    expect(await login("padaria", "nova-senha-789")).toMatchObject({ ok: true, tipo: "gerente" });
  });

  it("o admin redefine a senha pelo código: as sessões do cliente caem", async () => {
    const antes = await login("padaria", "nova-senha-789");
    await definirGerente(db, a, { usuario: "padaria", senha: "redefinida-000" }, admin);
    if (antes.ok) expect(await validarSessaoGerente(db, antes.token)).toBeNull();
    expect(await login("padaria", "redefinida-000")).toMatchObject({ ok: true });
  });

  it("remover o acesso de um código mantém a conta enquanto houver outro; sem nenhum, a conta some", async () => {
    const sessao = await login("padaria", "redefinida-000");
    expect(await removerGerente(db, b, admin)).toBe(true);
    expect((await obterCodigo(db, b))!.gerente_id).toBeNull();
    if (sessao.ok) expect(await validarSessaoGerente(db, sessao.token)).not.toBeNull();

    // "Remover dados do cliente" tira também o acesso; era o último código, então a conta é apagada.
    await operarCodigo(db, a, "limpar-dados", admin, true);
    expect((await obterCodigo(db, a))!.gerente_id).toBeNull();
    if (sessao.ok) expect(await validarSessaoGerente(db, sessao.token)).toBeNull();
    expect(await login("padaria", "redefinida-000")).toMatchObject({ ok: false });
    expect((await db.query("select 1 from gerentes where usuario = 'padaria'")).rows).toHaveLength(0);
    await aplicarRetencao(db, { acessosDias: 90, auditoriaDias: 730 });
  });
});
