import type { Db } from "./db";
import { ehViolacaoDeUnicidade } from "./db";
import { registrar } from "./auditoria";
import { ErroDeNegocio, type Ator } from "./codigos";
import { gerarEDecodificar } from "./qr";
import { gerarTokens, urlPublica } from "./token";
import type { ItemExportacao } from "./exportar";

export const LIMITE_LOTE = 500;
const NOME_VALIDO = /^[A-Za-zÀ-ÿ0-9 _.-]{1,40}$/;

export type Lote = {
  id: number; nome: string; quantidade: number; status: "GERANDO" | "PRONTO" | "ERRO";
  erro: string | null; criado_em: Date; criado_por_usuario: string | null;
};

export type OpcoesGeracao = {
  /** Lê de volta o QR da URL. Injetável nos testes. */
  decodificar?: (url: string) => string | null;
  gerarTokens?: (n: number) => string[];
};

/**
 * Cria um lote inteiro numa transação: ou todos os códigos existem e foram
 * conferidos, ou nenhum existe. Em caso de falha fica só um registro de lote com erro.
 */
export async function gerarLote(
  db: Db, entrada: { quantidade: number; nome?: string }, ator: Ator, base: string, op: OpcoesGeracao = {},
): Promise<Lote> {
  const quantidade = entrada.quantidade;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > LIMITE_LOTE) {
    throw new ErroDeNegocio(`A quantidade deve ser um número inteiro entre 1 e ${LIMITE_LOTE}.`);
  }
  const nome = (entrada.nome ?? "").trim() || `Lote ${new Date().toISOString().slice(0, 10)}`;
  if (!NOME_VALIDO.test(nome)) {
    throw new ErroDeNegocio("Nome do lote: até 40 caracteres, apenas letras, números, espaço, ponto, hífen e sublinhado.");
  }
  const decodificar = op.decodificar ?? gerarEDecodificar;
  const novosTokens = op.gerarTokens ?? gerarTokens;

  let ultimoErro: unknown;
  // Colisão de token é astronomicamente improvável; se acontecer, refaz tudo com tokens novos.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const id = await db.tx(async (tx) => {
        const lote = await tx.query<{ id: number }>(
          "insert into lotes (nome, quantidade, status, criado_por) values ($1, $2, 'GERANDO', $3) returning id",
          [nome, quantidade, ator.id]);
        const loteId = lote.rows[0]!.id;
        const tokens = novosTokens(quantidade);
        await tx.query(
          `insert into codigos (token, lote_id, criado_por, atualizado_por)
           select t, $2, $3, $3 from unnest($1::text[]) as t`,
          [tokens, loteId, ator.id]);

        // Conferência a partir do que ficou salvo, não do que estava em memória.
        const salvos = await tx.query<{ id: number; token: string }>(
          "select id, token from codigos where lote_id = $1", [loteId]);
        const esperados = new Set(tokens);
        if (salvos.rows.length !== quantidade || esperados.size !== quantidade) {
          throw new Error("contagem de códigos salvos difere da solicitada");
        }
        for (const salvo of salvos.rows) {
          const url = urlPublica(base, salvo.token);
          if (!esperados.has(salvo.token) || decodificar(url) !== url) {
            throw new Error("QR Code não decodifica para a URL do registro salvo");
          }
        }
        await tx.query("update lotes set status = 'PRONTO' where id = $1", [loteId]);
        await registrar(tx, { adminId: ator.id, loteId, acao: "LOTE_CRIADO", meta: { quantidade } });
        await tx.query(
          `insert into auditoria (admin_id, codigo_id, lote_id, acao)
           select $1, id, lote_id, 'CODIGO_CRIADO' from codigos where lote_id = $2`, [ator.id, loteId]);
        return loteId;
      });
      return (await obterLote(db, id))!;
    } catch (e) {
      ultimoErro = e;
      if (!ehViolacaoDeUnicidade(e)) break;
    }
  }
  const motivo = ultimoErro instanceof Error ? ultimoErro.message.slice(0, 200) : "erro desconhecido";
  await db
    .query("insert into lotes (nome, quantidade, status, erro, criado_por) values ($1, $2, 'ERRO', $3, $4)",
      [nome, quantidade, motivo, ator.id])
    .catch(() => {});
  throw new ErroDeNegocio("A geração falhou e nenhum código deste lote foi criado. Tente novamente.");
}

const SELECAO = `select l.id, l.nome, l.quantidade, l.status, l.erro, l.criado_em, a.usuario as criado_por_usuario
                   from lotes l left join admins a on a.id = l.criado_por`;

export async function obterLote(db: Db, id: number): Promise<Lote | null> {
  const { rows } = await db.query<Lote>(`${SELECAO} where l.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listarLotes(db: Db, limite = 200): Promise<Lote[]> {
  const { rows } = await db.query<Lote>(`${SELECAO} order by l.id desc limit $1`, [limite]);
  return rows;
}

export async function codigosDoLote(db: Db, loteId: number): Promise<(ItemExportacao & { id: number })[]> {
  const { rows } = await db.query<ItemExportacao & { id: number }>(
    "select id, numero, token, status from codigos where lote_id = $1 order by numero", [loteId]);
  return rows;
}
