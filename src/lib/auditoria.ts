import type { Db } from "./db";

export type Acao =
  | "LOGIN" | "LOTE_CRIADO" | "CODIGO_CRIADO" | "DESTINO_ALTERADO" | "CLIENTE_ASSOCIADO"
  | "REASSOCIADO" | "NOTAS_ALTERADAS" | "DESATIVADO" | "REATIVADO" | "ARQUIVADO"
  | "DESARQUIVADO" | "DADOS_REMOVIDOS" | "EXPORTACAO" | "MODO_ALTERADO" | "PAGINA_ALTERADA" | "IMAGEM_ALTERADA"
  | "GERENTE_DEFINIDO" | "GERENTE_REMOVIDO" | "SENHA_TROCADA";

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
  GERENTE_DEFINIDO: "Acesso do cliente definido",
  GERENTE_REMOVIDO: "Acesso do cliente removido",
  SENHA_TROCADA: "Senha trocada pelo cliente",
};

type Evento = {
  /** Quem fez: um administrador ou o gerente (usuário do cliente) do código. */
  adminId?: number | null;
  gerenteId?: number | null;
  acao: Acao;
  codigoId?: number | null;
  loteId?: number | null;
  /** Metadados mínimos. Nunca nomes de cliente, observações ou URL completa de destino. */
  meta?: Record<string, string | number | boolean | null>;
};

export async function registrar(db: Db, e: Evento): Promise<void> {
  await db.query(
    "insert into auditoria (admin_id, gerente_id, codigo_id, lote_id, acao, meta) values ($1, $2, $3, $4, $5, $6::jsonb)",
    [e.adminId ?? null, e.gerenteId ?? null, e.codigoId ?? null, e.loteId ?? null, e.acao, JSON.stringify(e.meta ?? {})],
  );
}

export type LinhaAuditoria = {
  id: number; em: Date; acao: Acao; meta: Record<string, unknown>;
  admin_usuario: string | null; gerente_usuario: string | null;
  codigo_id: number | null; numero: number | null; lote_id: number | null;
};

const SELECAO = `select au.id, au.em, au.acao, au.meta, a.usuario as admin_usuario, g.usuario as gerente_usuario,
                        au.codigo_id, c.numero, au.lote_id
                   from auditoria au
                   left join admins a on a.id = au.admin_id
                   left join gerentes g on g.id = au.gerente_id
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

/** Quem aparece na coluna de autor: o administrador ou, com a marca "cliente", o gerente. */
export const autorDe = (h: LinhaAuditoria): string =>
  h.admin_usuario ?? (h.gerente_usuario ? `${h.gerente_usuario} (cliente)` : "—");
