import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { emProducao } from "./env";
import { DURACAO_SESSAO_S, encerrarSessao, validarSessao, type Admin } from "./sessao";

// O prefixo __Host- obriga Secure, Path=/ e proíbe Domain: o cookie não vaza para subdomínios.
export const nomeDoCookie = () => (emProducao() ? "__Host-iqr_sessao" : "iqr_sessao");

export async function gravarCookieDeSessao(token: string): Promise<void> {
  (await cookies()).set(nomeDoCookie(), token, {
    httpOnly: true, secure: emProducao(), sameSite: "lax", path: "/", maxAge: DURACAO_SESSAO_S,
  });
}

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
  jar.delete(nomeDoCookie());
}
