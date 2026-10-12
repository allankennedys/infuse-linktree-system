import type { Db } from "./db";
import { registrar } from "./auditoria";
import { avisosDeDominio, hostDe, validarDestino, type OpcoesDestino } from "./destino";
import {
  obterPagina, salvarPagina, validarPagina, versoesDasImagens, type EntradaPagina, type Pagina, type TipoDeImagem,
} from "./pagina";
import { FORMATO_TOKEN } from "./token";

/** LINK: redireciona para um destino. PAGINA: mostra a página de links do código. */
export type Modo = "LINK" | "PAGINA";

export const STATUS = ["DISPONIVEL", "CONFIGURADO", "DESATIVADO", "ARQUIVADO"] as const;
export type Status = (typeof STATUS)[number];

export const ROTULO_STATUS: Record<Status, string> = {
  DISPONIVEL: "Disponível",
  CONFIGURADO: "Configurado",
  DESATIVADO: "Desativado",
  ARQUIVADO: "Arquivado",
};

export type Codigo = {
  id: number; token: string; numero: number; lote_id: number; lote_nome: string; status: Status;
  modo: Modo; pagina_titulo: string | null; destino: string | null; cliente: string | null; notas: string | null;
  acessos: number; ultimo_acesso_em: Date | null;
  criado_em: Date; atualizado_em: Date; configurado_em: Date | null;
  gerente_id: number | null; gerente_usuario: string | null;
};

/** Administrador que executa a operação. */
export type Ator = { id: number };
/** Usuário do cliente: só configura o conteúdo dos códigos ligados a ele. */
export type AtorGerente = { gerenteId: number };
const autor = (a: Ator | AtorGerente) =>
  "gerenteId" in a ? { adminId: null, gerenteId: a.gerenteId } : { adminId: a.id, gerenteId: null };

/** Erro com mensagem segura para mostrar ao administrador. */
export class ErroDeNegocio extends Error {}

const SELECAO = `select c.id, c.token, c.numero, c.lote_id, l.nome as lote_nome, c.status, c.modo,
                        p.titulo as pagina_titulo, c.destino, c.cliente, c.notas, c.acessos,
                        c.ultimo_acesso_em, c.criado_em, c.atualizado_em, c.configurado_em,
                        c.gerente_id, g.usuario as gerente_usuario
                   from codigos c join lotes l on l.id = c.lote_id
                   left join paginas p on p.codigo_id = c.id
                   left join gerentes g on g.id = c.gerente_id`;

export async function obterCodigo(db: Db, id: number): Promise<Codigo | null> {
  const { rows } = await db.query<Codigo>(`${SELECAO} where c.id = $1`, [id]);
  return rows[0] ?? null;
}

async function travar(db: Db, id: number): Promise<Codigo> {
  // Trava só a linha do código; o join com lotes vem numa segunda leitura.
  const trava = await db.query("select id from codigos where id = $1 for update", [id]);
  const codigo = trava.rows.length ? await obterCodigo(db, id) : null;
  if (!codigo) throw new ErroDeNegocio("Código não encontrado.");
  return codigo;
}

export type Filtros = { q?: string; status?: Status; loteId?: number; pagina?: number; porPagina?: number };

export async function listarCodigos(db: Db, f: Filtros = {}): Promise<{ itens: Codigo[]; total: number }> {
  const onde: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => `$${params.push(v)}`;

  if (f.status) onde.push(`c.status = ${p(f.status)}`);
  if (f.loteId) onde.push(`c.lote_id = ${p(f.loteId)}`);
  const q = (f.q ?? "").trim().slice(0, 80);
  if (q) {
    const padrao = p(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
    const ou = [`c.cliente ilike ${padrao}`, `l.nome ilike ${padrao}`, `g.usuario ilike ${padrao}`];
    const numero = /^(?:iq-?)?0*(\d{1,9})$/i.exec(q)?.[1];
    if (numero) ou.push(`c.numero = ${p(Number(numero))}`);
    onde.push(`(${ou.join(" or ")})`);
  }
  const filtro = onde.length ? `where ${onde.join(" and ")}` : "";
  const total = await db.query<{ n: number }>(
    `select count(*)::int as n from codigos c join lotes l on l.id = c.lote_id
       left join gerentes g on g.id = c.gerente_id ${filtro}`, params);

  const porPagina = Math.min(Math.max(f.porPagina ?? 25, 1), 100);
  const pagina = Math.max(f.pagina ?? 1, 1);
  const { rows } = await db.query<Codigo>(
    `${SELECAO} ${filtro} order by c.numero desc limit ${p(porPagina)} offset ${p((pagina - 1) * porPagina)}`, params);
  return { itens: rows, total: total.rows[0]?.n ?? 0 };
}

export async function contagens(db: Db): Promise<Record<Status, number> & { lotesComErro: number }> {
  const r = { DISPONIVEL: 0, CONFIGURADO: 0, DESATIVADO: 0, ARQUIVADO: 0, lotesComErro: 0 };
  const porStatus = await db.query<{ status: Status; n: number }>(
    "select status, count(*)::int as n from codigos group by status");
  for (const linha of porStatus.rows) r[linha.status] = linha.n;
  const erros = await db.query<{ n: number }>("select count(*)::int as n from lotes where status = 'ERRO'");
  r.lotesComErro = erros.rows[0]?.n ?? 0;
  return r;
}

export type EntradaConfiguracao = {
  destino: string; cliente: string; notas: string;
  /** Padrão: LINK. */
  modo?: Modo;
  /** Obrigatória quando modo = PAGINA. */
  pagina?: EntradaPagina;
  confirmarReassociacao?: boolean; confirmarAvisos?: boolean;
};

export type ResultadoConfiguracao =
  | { tipo: "salvo"; codigo: Codigo }
  | { tipo: "erro"; erro: string }
  | { tipo: "confirmar"; reassociacao: boolean; avisos: string[] };

const hostsDaPagina = (p: Pagina | null): string[] =>
  p ? [...p.links.map((l) => l.url), p.subtitulo_url].map(hostDe).filter((h): h is string => !!h) : [];

/**
 * Atualiza cliente, observações e o que o QR faz: redirecionar para um destino (LINK)
 * ou mostrar a página de links (PAGINA). Nunca toca no token: a URL impressa não muda.
 * Os dados do modo que não está em uso ficam guardados, então dá para alternar.
 * Trocar o cliente de um código já associado e usar domínio com alerta exigem confirmação.
 * Quando quem edita é o gerente (usuário do cliente), o código precisa ser dele, e os campos
 * internos (cliente e observações) ficam como estão, venha o que vier na entrada.
 */
export function configurarCodigo(
  db: Db, id: number, entrada: EntradaConfiguracao, ator: Ator | AtorGerente, op: OpcoesDestino = {},
): Promise<ResultadoConfiguracao> {
  return db.tx<ResultadoConfiguracao>(async (tx) => {
    const atual = await travar(tx, id);
    const quem = autor(ator);
    if (quem.gerenteId && atual.gerente_id !== quem.gerenteId) throw new ErroDeNegocio("Código não encontrado.");
    if (atual.status === "ARQUIVADO") {
      return { tipo: "erro", erro: quem.gerenteId ? "Este QR Code está fora de uso." : "Código arquivado. Desarquive antes de configurar." };
    }
    const modo: Modo = entrada.modo ?? "LINK";
    const cliente = quem.gerenteId ? atual.cliente : entrada.cliente.trim() || null;
    const notas = quem.gerenteId ? atual.notas : entrada.notas.trim() || null;
    if (cliente && cliente.length > 120) return { tipo: "erro", erro: "Nome do cliente: máximo de 120 caracteres." };
    if (notas && notas.length > 1000) return { tipo: "erro", erro: "Observações: máximo de 1000 caracteres." };

    // No modo PAGINA o destino direto fica como estava; no modo LINK, a página fica como estava.
    let destino = atual.destino;
    let pagina: Pagina | null = null;
    const paginaAtual = await obterPagina(tx, id);
    let hostsNovos: string[] = [];
    if (modo === "LINK") {
      destino = null;
      if (entrada.destino.trim()) {
        const v = validarDestino(entrada.destino, op);
        if (!v.ok) return { tipo: "erro", erro: v.erro };
        destino = v.url;
        if (v.host !== hostDe(atual.destino)) hostsNovos = [v.host];
      }
    } else {
      if (!entrada.pagina) return { tipo: "erro", erro: "Preencha a página de links." };
      const v = validarPagina(entrada.pagina, op);
      if (!v.ok) return { tipo: "erro", erro: v.erro };
      pagina = v.pagina;
      const antes = new Set(hostsDaPagina(paginaAtual));
      hostsNovos = [...new Set(hostsDaPagina(pagina))].filter((h) => !antes.has(h));
    }

    const reassociacao = !!atual.cliente && cliente !== atual.cliente;
    let avisos: string[] = [];
    if (hostsNovos.length > 0) {
      const outros = await tx.query<{ url: string }>(
        `select distinct destino as url from codigos where destino is not null and id <> $1
         union select distinct url from pagina_links where codigo_id <> $1
         limit 5000`, [id]);
      const emUso = outros.rows.map((o) => hostDe(o.url)).filter((h): h is string => !!h);
      avisos = [...new Set(hostsNovos.flatMap((h) => avisosDeDominio(h, emUso)))];
    }
    const faltaReassociacao = reassociacao && !entrada.confirmarReassociacao;
    const faltaAvisos = avisos.length > 0 && !entrada.confirmarAvisos;
    if (faltaReassociacao || faltaAvisos) {
      return { tipo: "confirmar", reassociacao: faltaReassociacao, avisos: faltaAvisos ? avisos : [] };
    }

    const mudouModo = modo !== atual.modo;
    const mudouDestino = destino !== atual.destino;
    const mudouPagina = !!pagina && JSON.stringify(pagina) !== JSON.stringify(paginaAtual);
    const mudouCliente = cliente !== atual.cliente;
    const mudouNotas = notas !== atual.notas;
    if (!mudouModo && !mudouDestino && !mudouPagina && !mudouCliente && !mudouNotas) {
      return { tipo: "salvo", codigo: atual };
    }

    const temConteudo = modo === "PAGINA" ? true : !!destino;
    // Desativado continua desativado: editar não pode religar um código sem querer.
    const status: Status = atual.status === "DESATIVADO" ? "DESATIVADO" : temConteudo ? "CONFIGURADO" : "DISPONIVEL";
    if (pagina && mudouPagina) await salvarPagina(tx, id, pagina);
    await tx.query(
      `update codigos set destino = $2, cliente = $3, notas = $4, status = $5, modo = $6, atualizado_em = now(),
              atualizado_por = $7,
              configurado_em = case when $8 then (case when $9 then now() else null end) else configurado_em end
        where id = $1`,
      [id, destino, cliente, notas, status, modo, quem.adminId, mudouModo || mudouDestino || mudouPagina, temConteudo],
    );
    if (mudouModo) {
      await registrar(tx, { ...quem, codigoId: id, acao: "MODO_ALTERADO", meta: { de: atual.modo, para: modo } });
    }
    if (mudouDestino) {
      await registrar(tx, {
        ...quem, codigoId: id, acao: "DESTINO_ALTERADO",
        meta: { de_host: hostDe(atual.destino), para_host: hostDe(destino) },
      });
    }
    if (mudouPagina) {
      await registrar(tx, { ...quem, codigoId: id, acao: "PAGINA_ALTERADA", meta: { links: pagina!.links.length } });
    }
    if (mudouCliente) {
      await registrar(tx, { ...quem, codigoId: id, acao: reassociacao ? "REASSOCIADO" : "CLIENTE_ASSOCIADO" });
    }
    if (mudouNotas) await registrar(tx, { ...quem, codigoId: id, acao: "NOTAS_ALTERADAS" });
    return { tipo: "salvo", codigo: (await obterCodigo(tx, id))! };
  });
}

export type Operacao = "desativar" | "reativar" | "arquivar" | "desarquivar" | "limpar-dados";
/** Operações que podem quebrar um código já vendido: exigem confirmação explícita. */
export const EXIGE_CONFIRMACAO: Record<Operacao, boolean> = {
  desativar: true, reativar: false, arquivar: true, desarquivar: false, "limpar-dados": true,
};

export function operarCodigo(db: Db, id: number, operacao: Operacao, ator: Ator, confirmado: boolean): Promise<Codigo> {
  return db.tx(async (tx) => {
    if (EXIGE_CONFIRMACAO[operacao] && !confirmado) {
      throw new ErroDeNegocio("Marque a confirmação para executar esta operação.");
    }
    const c = await travar(tx, id);
    const mudar = (status: Status) =>
      tx.query("update codigos set status = $2, atualizado_em = now(), atualizado_por = $3 where id = $1",
        [id, status, ator.id]);

    switch (operacao) {
      case "desativar":
        if (c.status !== "DISPONIVEL" && c.status !== "CONFIGURADO") {
          throw new ErroDeNegocio("Só códigos disponíveis ou configurados podem ser desativados.");
        }
        await mudar("DESATIVADO");
        await registrar(tx, { adminId: ator.id, codigoId: id, acao: "DESATIVADO" });
        break;
      case "reativar":
        if (c.status !== "DESATIVADO") throw new ErroDeNegocio("O código não está desativado.");
        // Sem conteúdo salvo volta a disponível; nunca ganha um destino arbitrário.
        await mudar((c.modo === "PAGINA" ? !!c.pagina_titulo : !!c.destino) ? "CONFIGURADO" : "DISPONIVEL");
        await registrar(tx, { adminId: ator.id, codigoId: id, acao: "REATIVADO" });
        break;
      case "arquivar":
        if (c.status === "ARQUIVADO") throw new ErroDeNegocio("O código já está arquivado.");
        await mudar("ARQUIVADO");
        await registrar(tx, { adminId: ator.id, codigoId: id, acao: "ARQUIVADO", meta: { status_anterior: c.status } });
        break;
      case "desarquivar":
        if (c.status !== "ARQUIVADO") throw new ErroDeNegocio("O código não está arquivado.");
        // Volta desativado: reativar é uma decisão separada e explícita.
        await mudar("DESATIVADO");
        await registrar(tx, { adminId: ator.id, codigoId: id, acao: "DESARQUIVADO" });
        break;
      case "limpar-dados":
        await tx.query(
          `update codigos set cliente = null, notas = null, destino = null, configurado_em = null, modo = 'LINK',
                  gerente_id = null,
                  status = case when status = 'CONFIGURADO' then 'DISPONIVEL' else status end,
                  atualizado_em = now(), atualizado_por = $2
            where id = $1`, [id, ator.id]);
        await tx.query("delete from paginas where codigo_id = $1", [id]);
        await tx.query("delete from imagens where codigo_id = $1", [id]);
        // O acesso do cliente sai junto; a conta some se não tiver outro código.
        await tx.query(
          "delete from gerentes g where g.id = $1 and not exists (select 1 from codigos c where c.gerente_id = g.id)",
          [c.gerente_id]);
        // Os eventos antigos ficam, mas os hosts de destino registrados neles são apagados.
        await tx.query(
          "update auditoria set meta = meta - 'de_host' - 'para_host' where codigo_id = $1 and acao = 'DESTINO_ALTERADO'",
          [id]);
        await registrar(tx, { adminId: ator.id, codigoId: id, acao: "DADOS_REMOVIDOS" });
        break;
    }
    return (await obterCodigo(tx, id))!;
  });
}

export type Leitura =
  | { tipo: "link"; id: number; destino: string }
  | { tipo: "disponivel"; id: number; numero: number }
  | { tipo: "pagina"; id: number; pagina: Pagina; imagens: Partial<Record<TipoDeImagem, number>> };

/**
 * Resolve um token público. Código CONFIGURADO devolve o destino (se ainda passa na
 * validação atual) ou a página de links; código DISPONIVEL devolve só o nº de inventário.
 * Qualquer outro caso é null, sem distinção.
 */
export async function resolverToken(db: Db, token: string, op: OpcoesDestino = {}): Promise<Leitura | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const { rows } = await db.query<{ id: number; numero: number; status: Status; modo: Modo; destino: string | null }>(
    "select id, numero, status, modo, destino from codigos where token = $1", [token]);
  const c = rows[0];
  if (c?.status === "DISPONIVEL") return { tipo: "disponivel", id: c.id, numero: c.numero };
  if (!c || c.status !== "CONFIGURADO") return null;
  if (c.modo === "PAGINA") {
    const salva = await obterPagina(db, c.id);
    if (!salva) return null;
    // Links que deixaram de passar na política atual somem da página.
    const pagina = { ...salva, links: salva.links.filter((l) => l.pix || validarDestino(l.url, op).ok) };
    if (pagina.links.length === 0) return null;
    if (pagina.subtitulo_url && !validarDestino(pagina.subtitulo_url, op).ok) pagina.subtitulo_url = null;
    return { tipo: "pagina", id: c.id, pagina, imagens: await versoesDasImagens(db, c.id) };
  }
  if (!c.destino) return null;
  const v = validarDestino(c.destino, op);
  return v.ok ? { tipo: "link", id: c.id, destino: v.url } : null;
}

/** Contagem agregada: total do código e total por hora. Nada que identifique quem leu. */
export async function registrarAcesso(db: Db, codigoId: number): Promise<void> {
  await db.query(
    "update codigos set acessos = acessos + 1, ultimo_acesso_em = date_trunc('hour', now()) where id = $1", [codigoId]);
  await db.query(
    `insert into acessos_hora (codigo_id, hora, total) values ($1, date_trunc('hour', now()), 1)
     on conflict (codigo_id, hora) do update set total = acessos_hora.total + 1`, [codigoId]);
}

/** Códigos que o gerente pode editar. Arquivados ficam de fora: estão fora de circulação. */
export async function codigosDoGerente(db: Db, gerenteId: number): Promise<Codigo[]> {
  const { rows } = await db.query<Codigo>(
    `${SELECAO} where c.gerente_id = $1 and c.status <> 'ARQUIVADO' order by c.numero`, [gerenteId]);
  return rows;
}
