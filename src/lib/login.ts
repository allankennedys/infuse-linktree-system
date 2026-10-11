import type { Db } from "./db";
import { registrar } from "./auditoria";
import { chaveAnonima, consumirLimite } from "./limite";
import { autenticarGerente, criarSessaoGerente } from "./gerentes";
import { autenticar, criarSessao } from "./sessao";

export const LIMITE_LOGIN = { porIp: 20, porUsuario: 8, janelaSeg: 15 * 60 };

export type ResultadoLogin = { ok: true; token: string; tipo: "admin" | "gerente" } | { ok: false; erro: string };

/**
 * Login com limite de tentativas por IP e por usuário (ambos anonimizados por HMAC).
 * O mesmo formulário serve ao administrador e ao gerente (usuário do cliente); `tipo` diz quem entrou.
 */
export async function entrar(
  db: Db, dados: { usuario: string; senha: string; ip: string; segredo: string },
): Promise<ResultadoLogin> {
  const usuario = dados.usuario.trim().toLowerCase().slice(0, 200);
  const { porIp, porUsuario, janelaSeg } = LIMITE_LOGIN;
  const ipOk = await consumirLimite(db, chaveAnonima("login-ip", dados.ip, dados.segredo), porIp, janelaSeg);
  const usuarioOk = await consumirLimite(db, chaveAnonima("login-usuario", usuario, dados.segredo), porUsuario, janelaSeg);
  if (!ipOk || !usuarioOk) return { ok: false, erro: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };

  const senha = dados.senha.slice(0, 500);
  const admin = await autenticar(db, usuario, senha);
  if (admin) {
    const token = await criarSessao(db, admin.id);
    await registrar(db, { adminId: admin.id, acao: "LOGIN" });
    return { ok: true, token, tipo: "admin" };
  }
  const gerente = await autenticarGerente(db, usuario, senha);
  if (!gerente) return { ok: false, erro: "Usuário ou senha incorretos." };
  const token = await criarSessaoGerente(db, gerente.id);
  await registrar(db, { gerenteId: gerente.id, acao: "LOGIN" });
  return { ok: true, token, tipo: "gerente" };
}
