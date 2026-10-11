import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db";
import { registrar } from "./auditoria";
import { ErroDeNegocio, type Ator } from "./codigos";
import { conferirSenha, gerarHash, hashFalso } from "./senha";
import { DURACAO_SESSAO_S } from "./sessao";

/** Usuário do cliente: edita só os códigos ligados a ele, numa área separada do painel. */
export type Gerente = { id: number; usuario: string };

export const SENHA_MINIMA_GERENTE = 8;
const FORMATO_USUARIO = /^[a-z0-9][a-z0-9._-]{2,39}$/;

const resumo = (token: string) => createHash("sha256").update(token).digest("hex");

export async function gerenteDoCodigo(db: Db, codigoId: number): Promise<Gerente | null> {
  const { rows } = await db.query<Gerente>(
    "select g.id, g.usuario from codigos c join gerentes g on g.id = c.gerente_id where c.id = $1", [codigoId]);
  return rows[0] ?? null;
}

/**
 * Liga um código a um usuário de cliente. Usuário novo exige senha; usuário que já existe
 * (cliente com mais de uma plaquinha) é só ligado, e a senha, se informada, é trocada.
 */
export function definirGerente(
  db: Db, codigoId: number, entrada: { usuario: string; senha: string }, ator: Ator,
): Promise<Gerente> {
  return db.tx(async (tx) => {
    const usuario = entrada.usuario.trim().toLowerCase();
    const senha = entrada.senha;
    if (!FORMATO_USUARIO.test(usuario)) {
      throw new ErroDeNegocio("Usuário: de 3 a 40 caracteres, só letras minúsculas, números, ponto, hífen e sublinhado.");
    }
    if (senha && senha.length < SENHA_MINIMA_GERENTE) {
      throw new ErroDeNegocio(`Senha: mínimo de ${SENHA_MINIMA_GERENTE} caracteres.`);
    }
    if (senha.length > 200) throw new ErroDeNegocio("Senha: máximo de 200 caracteres.");
    const codigo = await tx.query<{ status: string; gerente_id: number | null }>(
      "select status, gerente_id from codigos where id = $1 for update", [codigoId]);
    if (!codigo.rows[0]) throw new ErroDeNegocio("Código não encontrado.");
    if (codigo.rows[0].status === "ARQUIVADO") throw new ErroDeNegocio("Código arquivado. Desarquive antes de alterar.");
    // O login é o mesmo para administradores e clientes: os nomes não podem coincidir.
    const admin = await tx.query("select 1 from admins where usuario = $1", [usuario]);
    if (admin.rows.length) throw new ErroDeNegocio("Este usuário já é de um administrador. Escolha outro.");

    const existente = await tx.query<Gerente>("select id, usuario from gerentes where usuario = $1 for update", [usuario]);
    let gerente = existente.rows[0];
    if (gerente) {
      if (senha) {
        await tx.query("update gerentes set senha_hash = $2, ativo = true where id = $1", [gerente.id, await gerarHash(senha)]);
        await tx.query("delete from sessoes_gerente where gerente_id = $1", [gerente.id]);
      }
    } else {
      if (!senha) throw new ErroDeNegocio("Defina uma senha para o novo usuário.");
      const novo = await tx.query<Gerente>(
        "insert into gerentes (usuario, senha_hash, criado_por) values ($1, $2, $3) returning id, usuario",
        [usuario, await gerarHash(senha), ator.id]);
      gerente = novo.rows[0]!;
    }
    const anterior = codigo.rows[0].gerente_id;
    if (anterior !== gerente.id) {
      await tx.query("update codigos set gerente_id = $2, atualizado_em = now(), atualizado_por = $3 where id = $1",
        [codigoId, gerente.id, ator.id]);
      await apagarSeOrfao(tx, anterior);
    }
    if (anterior !== gerente.id || senha) {
      await registrar(tx, { adminId: ator.id, codigoId, acao: "GERENTE_DEFINIDO", meta: { senha_trocada: !!senha && !!existente.rows[0] } });
    }
    return gerente;
  });
}

/** Tira o acesso do cliente a este código. A conta some junto se não tiver outro código. */
export function removerGerente(db: Db, codigoId: number, ator: Ator): Promise<boolean> {
  return db.tx(async (tx) => {
    const { rows } = await tx.query<{ gerente_id: number | null }>(
      "select gerente_id from codigos where id = $1 for update", [codigoId]);
    const anterior = rows[0]?.gerente_id;
    if (!anterior) return false;
    await tx.query("update codigos set gerente_id = null, atualizado_em = now(), atualizado_por = $2 where id = $1",
      [codigoId, ator.id]);
    await apagarSeOrfao(tx, anterior);
    await registrar(tx, { adminId: ator.id, codigoId, acao: "GERENTE_REMOVIDO" });
    return true;
  });
}

/** Conta de cliente sem nenhum código não serve para nada: apaga, e as sessões vão junto. */
export async function apagarSeOrfao(db: Db, gerenteId: number | null | undefined): Promise<void> {
  if (!gerenteId) return;
  await db.query(
    "delete from gerentes g where g.id = $1 and not exists (select 1 from codigos c where c.gerente_id = g.id)",
    [gerenteId]);
}

/** Mesma resposta e tempo parecido para usuário inexistente e senha errada. */
export async function autenticarGerente(db: Db, usuario: string, senha: string): Promise<Gerente | null> {
  const { rows } = await db.query<Gerente & { senha_hash: string; ativo: boolean }>(
    "select id, usuario, senha_hash, ativo from gerentes where usuario = $1", [usuario.trim().toLowerCase()]);
  const g = rows[0];
  const confere = await conferirSenha(senha, g?.senha_hash ?? (await hashFalso()));
  if (!g || !g.ativo || !confere) return null;
  return { id: g.id, usuario: g.usuario };
}

export async function criarSessaoGerente(db: Db, gerenteId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "insert into sessoes_gerente (token_hash, gerente_id, expira_em) values ($1, $2, now() + make_interval(secs => $3))",
    [resumo(token), gerenteId, DURACAO_SESSAO_S]);
  return token;
}

export async function validarSessaoGerente(db: Db, token: string | undefined | null): Promise<Gerente | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query<Gerente>(
    `select g.id, g.usuario from sessoes_gerente s join gerentes g on g.id = s.gerente_id
      where s.token_hash = $1 and s.expira_em > now() and g.ativo`, [resumo(token)]);
  return rows[0] ?? null;
}

export async function encerrarSessaoGerente(db: Db, token: string | undefined | null): Promise<void> {
  if (token) await db.query("delete from sessoes_gerente where token_hash = $1", [resumo(token)]);
}

/** Troca feita pelo próprio cliente. Encerra as outras sessões dele; a atual (`manter`) continua. */
export async function trocarSenhaDoGerente(
  db: Db, gerenteId: number, atual: string, nova: string, manter?: string | null,
): Promise<void> {
  if (nova.length < SENHA_MINIMA_GERENTE) throw new ErroDeNegocio(`A nova senha precisa ter pelo menos ${SENHA_MINIMA_GERENTE} caracteres.`);
  if (nova.length > 200) throw new ErroDeNegocio("A nova senha pode ter no máximo 200 caracteres.");
  const { rows } = await db.query<{ senha_hash: string }>("select senha_hash from gerentes where id = $1 and ativo", [gerenteId]);
  if (!rows[0] || !(await conferirSenha(atual.slice(0, 500), rows[0].senha_hash))) {
    throw new ErroDeNegocio("A senha atual não confere.");
  }
  await db.query("update gerentes set senha_hash = $2 where id = $1", [gerenteId, await gerarHash(nova)]);
  await db.query("delete from sessoes_gerente where gerente_id = $1 and token_hash <> $2", [gerenteId, manter ? resumo(manter) : ""]);
  await registrar(db, { gerenteId, acao: "SENHA_TROCADA" });
}
