import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { emProducao } from "./env";
import { encerrarSessaoGerente, validarSessaoGerente, type Gerente } from "./gerentes";
import { DURACAO_SESSAO_S, encerrarSessao, validarSessao, type Admin } from "./sessao";

// O prefixo __Host- obriga Secure, Path=/ e proíbe Domain: o cookie não vaza para subdomínios.
export const nomeDoCookie = () => (emProducao() ? "__Host-iqr_sessao" : "iqr_sessao");

export async function adminAtual(): Promise<Admin | null> {
  return validarSessao(getDb(), (await cookies()).get(nomeDoCookie())?.value);
}

/** Para páginas e server actions: sem sessão válida, vai para o login. */
export async function exigirAdmin(): Promise<Admin> {
  const admin = await adminAtual();
  if (!admin) redirect("/login");
  return admin;
}

function cookieDe(req: Request, nome: string): string | undefined {
  for (const parte of (req.headers.get("cookie") ?? "").split(";")) {
    const [chave, ...valor] = parte.trim().split("=");
    if (chave === nome) return valor.join("=");
  }
  return undefined;
}

/** Para route handlers: devolve o admin ou null (o handler responde 401). */
export function adminDoRequest(req: Request): Promise<Admin | null> {
  return validarSessao(getDb(), cookieDe(req, nomeDoCookie()));
}

export async function sair(): Promise<void> {
  const jar = await cookies();
  await encerrarSessao(getDb(), jar.get(nomeDoCookie())?.value);
  await encerrarSessaoGerente(getDb(), jar.get(nomeDoCookieDoGerente())?.value);
  jar.delete(nomeDoCookie());
  jar.delete(nomeDoCookieDoGerente());
}

// ---- Gerente (usuário do cliente): cookie e sessão próprios, nunca aceitos como administrador ----

export const nomeDoCookieDoGerente = () => (emProducao() ? "__Host-iqr_cliente" : "iqr_cliente");

/** Grava o cookie de quem acabou de entrar e apaga o do outro tipo: um navegador, uma conta. */
export async function gravarCookieDeLogin(tipo: "admin" | "gerente", token: string): Promise<void> {
  const jar = await cookies();
  const [este, outro] = tipo === "admin" ? [nomeDoCookie(), nomeDoCookieDoGerente()] : [nomeDoCookieDoGerente(), nomeDoCookie()];
  jar.set(este, token, { httpOnly: true, secure: emProducao(), sameSite: "lax", path: "/", maxAge: DURACAO_SESSAO_S });
  jar.delete(outro);
}

export async function tokenDoGerente(): Promise<string | undefined> {
  return (await cookies()).get(nomeDoCookieDoGerente())?.value;
}

export async function gerenteAtual(): Promise<Gerente | null> {
  return validarSessaoGerente(getDb(), await tokenDoGerente());
}

/** Para páginas e server actions da área do cliente: sem sessão válida, vai para o login. */
export async function exigirGerente(): Promise<Gerente> {
  const gerente = await gerenteAtual();
  if (!gerente) redirect("/login");
  return gerente;
}

/**
 * Para as rotas de um código (QR, prévia, imagens): entra o administrador ou o gerente
 * daquele código. Sem permissão devolve null e o handler responde 401.
 */
export async function acessoAoCodigo(req: Request, codigoId: number): Promise<{ adminId: number } | { gerenteId: number } | null> {
  const admin = await adminDoRequest(req);
  if (admin) return { adminId: admin.id };
  const gerente = await validarSessaoGerente(getDb(), cookieDe(req, nomeDoCookieDoGerente()));
  if (!gerente) return null;
  const { rows } = await getDb().query(
    "select 1 from codigos where id = $1 and gerente_id = $2 and status <> 'ARQUIVADO'", [codigoId, gerente.id]);
  return rows.length ? { gerenteId: gerente.id } : null;
}

/** Há alguém logado neste pedido, administrador ou gerente? */
export async function alguemLogado(req: Request): Promise<boolean> {
  return !!(await adminDoRequest(req)) || !!(await validarSessaoGerente(getDb(), cookieDe(req, nomeDoCookieDoGerente())));
}
