import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db";
import { conferirSenha, hashFalso } from "./senha";

export type Admin = { id: number; usuario: string; nome: string };

export const DURACAO_SESSAO_S = 12 * 60 * 60;

const resumo = (token: string) => createHash("sha256").update(token).digest("hex");

/** Confere usuário e senha. Mesma resposta e tempo parecido para usuário inexistente e senha errada. */
export async function autenticar(db: Db, usuario: string, senha: string): Promise<Admin | null> {
  const { rows } = await db.query<Admin & { senha_hash: string; ativo: boolean }>(
    "select id, usuario, nome, senha_hash, ativo from admins where usuario = $1",
    [usuario.trim().toLowerCase()],
  );
  const admin = rows[0];
  const confere = await conferirSenha(senha, admin?.senha_hash ?? (await hashFalso()));
  if (!admin || !admin.ativo || !confere) return null;
  return { id: admin.id, usuario: admin.usuario, nome: admin.nome };
}

/** Cria a sessão e devolve o token do cookie. No banco fica só o SHA-256 dele. */
export async function criarSessao(db: Db, adminId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "insert into sessoes (token_hash, admin_id, expira_em) values ($1, $2, now() + make_interval(secs => $3))",
    [resumo(token), adminId, DURACAO_SESSAO_S],
  );
  return token;
}

export async function validarSessao(db: Db, token: string | undefined | null): Promise<Admin | null> {
  if (!token || token.length > 200) return null;
  const { rows } = await db.query<Admin>(
    `select a.id, a.usuario, a.nome from sessoes s join admins a on a.id = s.admin_id
      where s.token_hash = $1 and s.expira_em > now() and a.ativo`,
    [resumo(token)],
  );
  return rows[0] ?? null;
}

export async function encerrarSessao(db: Db, token: string | undefined | null): Promise<void> {
  if (token) await db.query("delete from sessoes where token_hash = $1", [resumo(token)]);
}
