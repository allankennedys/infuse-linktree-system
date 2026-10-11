import type { Db } from "./db";

export type Acao =
  | "LOGIN" | "LOTE_CRIADO" | "CODIGO_CRIADO" | "DESTINO_ALTERADO" | "CLIENTE_ASSOCIADO"
  | "REASSOCIADO" | "NOTAS_ALTERADAS" | "DESATIVADO" | "REATIVADO" | "ARQUIVADO"
  | "DESARQUIVADO" | "DADOS_REMOVIDOS" | "EXPORTACAO" | "MODO_ALTERADO" | "PAGINA_ALTERADA" | "IMAGEM_ALTERADA";

export const ROTULO_ACAO: Record<Acao, string> = {
  LOGIN: "Login no painel",
  LOTE_CRIADO: "Lote gerado",
  CODIGO_CRIADO: "Código criado",
  DESTINO_ALTERADO: "Destino alterado",
  CLIENTE_ASSOCIADO: "Cliente associado",
  REASSOCIADO: "Reassociado a outro cliente",
  NOTAS_ALTERADAS: "Observações alteradas",
  DESATIVADO: "Desativado",
  REATIVADO: "Reativado",
  ARQUIVADO: "Arquivado",
  DESARQUIVADO: "Desarquivado",
  DADOS_REMOVIDOS: "Dados do cliente removidos",
  EXPORTACAO: "Exportação",
  MODO_ALTERADO: "Tipo de destino alterado",
  PAGINA_ALTERADA: "Página de links alterada",
  IMAGEM_ALTERADA: "Imagem da página alterada",
};

type Evento = {
  adminId: number | null;
  acao: Acao;
  codigoId?: number | null;
  loteId?: number | null;
  /** Metadados mínimos. Nunca nomes de cliente, observações ou URL completa de destino. */
  meta?: Record<string, string | number | boolean | null>;
};

export async function registrar(db: Db, e: Evento): Promise<void> {
  await db.query(
    "insert into auditoria (admin_id, codigo_id, lote_id, acao, meta) values ($1, $2, $3, $4, $5::jsonb)",
    [e.adminId, e.codigoId ?? null, e.loteId ?? null, e.acao, JSON.stringify(e.meta ?? {})],
  );
}

export type LinhaAuditoria = {
  id: number; em: Date; acao: Acao; meta: Record<string, unknown>;
  admin_usuario: string | null; codigo_id: number | null; numero: number | null; lote_id: number | null;
};

const SELECAO = `select au.id, au.em, au.acao, au.meta, a.usuario as admin_usuario,
                        au.codigo_id, c.numero, au.lote_id
                   from auditoria au
                   left join admins a on a.id = au.admin_id
                   left join codigos c on c.id = au.codigo_id`;

export async function historicoDoCodigo(db: Db, codigoId: number, limite = 100): Promise<LinhaAuditoria[]> {
  const { rows } = await db.query<LinhaAuditoria>(
    `${SELECAO} where au.codigo_id = $1 order by au.em desc, au.id desc limit $2`, [codigoId, limite]);
  return rows;
}

export async function listarAuditoria(db: Db, pagina: number, porPagina = 50) {
  const { rows } = await db.query<LinhaAuditoria>(
    // A criação de cada código já aparece resumida em LOTE_CRIADO.
    `${SELECAO} where au.acao <> 'CODIGO_CRIADO' order by au.em desc, au.id desc limit $1 offset $2`,
    [porPagina, (pagina - 1) * porPagina]);
  const total = await db.query<{ n: number }>("select count(*)::int as n from auditoria where acao <> 'CODIGO_CRIADO'");
  return { itens: rows, total: total.rows[0]?.n ?? 0 };
}
