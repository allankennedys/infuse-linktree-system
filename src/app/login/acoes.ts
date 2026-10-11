"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { gravarCookieDeSessao } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { segredoDeSessao } from "@/lib/env";
import { ipDe } from "@/lib/limite";
import { entrar } from "@/lib/login";

export type EstadoLogin = { erro?: string };

export async function acaoEntrar(_: EstadoLogin, fd: FormData): Promise<EstadoLogin> {
  let token: string;
  try {
    const r = await entrar(getDb(), {
      usuario: String(fd.get("usuario") ?? ""),
      senha: String(fd.get("senha") ?? ""),
      ip: ipDe(await headers()),
      segredo: segredoDeSessao(),
    });
    if (!r.ok) return { erro: r.erro };
    token = r.token;
  } catch (e) {
    console.error("[infuse-qr] falha no login:", e instanceof Error ? e.message : "erro desconhecido");
    return { erro: "Não foi possível entrar agora. Verifique a configuração do servidor." };
  }
  await gravarCookieDeSessao(token);
  redirect("/");
}
