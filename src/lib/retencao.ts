import type { Db } from "./db";
import { retencaoAcessosDias, retencaoAuditoriaDias } from "./env";

/** Apaga o que passou do prazo de retenção. Idempotente; roda uma vez por dia. */
export async function aplicarRetencao(db: Db, op = { acessosDias: retencaoAcessosDias(), auditoriaDias: retencaoAuditoriaDias() }) {
  const sessoes = await db.query("delete from sessoes where expira_em < now()");
  const limites = await db.query("delete from limites where janela < now() - interval '1 day'");
  const acessos = await db.query("delete from acessos_hora where hora < now() - make_interval(days => $1)", [op.acessosDias]);
  const auditoria = await db.query("delete from auditoria where em < now() - make_interval(days => $1)", [op.auditoriaDias]);
  return { sessoes: sessoes.rowCount, limites: limites.rowCount, acessos: acessos.rowCount, auditoria: auditoria.rowCount };
}
