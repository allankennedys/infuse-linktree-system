"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import type { EstadoConfiguracao, EstadoSimples } from "@/app/(painel)/acoes";
import { exigirGerente, tokenDoGerente } from "@/lib/auth";
import { configurarCodigo, ErroDeNegocio, type Modo } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { hostsPermitidos, permiteDestinoLocal, segredoDeSessao } from "@/lib/env";
import { garantirFavicons, hostsComIconeDeLink } from "@/lib/favicon";
import { inteiroPositivo } from "@/lib/formato";
import { trocarSenhaDoGerente } from "@/lib/gerentes";
import { trocarImagem } from "@/lib/imagem-acao";
import { linksDoFormulario } from "@/lib/pagina";
import { chaveAnonima, consumirLimite, ipDe } from "@/lib/limite";

// Toda action começa por exigirGerente(), e a regra "o código é deste gerente" é conferida
// de novo dentro da operação: o id vem do formulário e não é confiável.

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "");

function mensagemDe(e: unknown): string {
  if (e instanceof ErroDeNegocio) return e.message;
  console.error("[infuse-qr] falha em action do cliente:", e instanceof Error ? e.message : "erro desconhecido");
  return "Não foi possível salvar agora. Tente de novo.";
}

export async function acaoConfigurarCliente(_: EstadoConfiguracao, fd: FormData): Promise<EstadoConfiguracao> {
  const gerente = await exigirGerente();
  const id = inteiroPositivo(texto(fd, "id"));
  if (!id) return { tipo: "erro", erro: "Código inválido." };
  const modo: Modo = texto(fd, "modo") === "PAGINA" ? "PAGINA" : "LINK";
  const links = linksDoFormulario(fd);
  try {
    const r = await configurarCodigo(
      getDb(), id,
      {
        // Cliente e observações são campos internos: o gerente não altera, o que vier aqui é ignorado.
        destino: texto(fd, "destino"), cliente: "", notas: "", modo,
        pagina: modo === "PAGINA" ? {
          titulo: texto(fd, "p_titulo"), subtitulo: texto(fd, "p_subtitulo"), subtitulo_url: texto(fd, "p_subtitulo_url"),
          rodape: texto(fd, "p_rodape"), cor_fundo: texto(fd, "p_cor_fundo"), cor_destaque: texto(fd, "p_cor_destaque"), fundo_opacidade: texto(fd, "p_fundo_opacidade"),
          links,
        } : undefined,
        confirmarAvisos: fd.get("confirmarAvisos") === "on",
      },
      { gerenteId: gerente.id }, { hostsPermitidos: hostsPermitidos(), permitirLocal: permiteDestinoLocal() },
    );
    if (r.tipo !== "salvo") return r;
    // Guarda o favicon dos botões "Link". Se a busca falhar, a página fica com o ícone genérico.
    if (modo === "PAGINA") {
      await garantirFavicons(getDb(), hostsComIconeDeLink({ links }))
        .catch(() => {});
    }
    revalidatePath("/", "layout");
    return { tipo: "salvo", modo: r.codigo.modo, destino: r.codigo.destino };
  } catch (e) {
    return { tipo: "erro", erro: mensagemDe(e) };
  }
}

export async function acaoImagemCliente(_: EstadoSimples, fd: FormData): Promise<EstadoSimples> {
  const gerente = await exigirGerente();
  try {
    const r = await trocarImagem(getDb(), inteiroPositivo(texto(fd, "id")), fd, { gerenteId: gerente.id });
    if (r.ok) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

export async function acaoTrocarSenha(_: EstadoSimples, fd: FormData): Promise<EstadoSimples> {
  const gerente = await exigirGerente();
  const nova = texto(fd, "nova");
  if (nova !== texto(fd, "repetir")) return { erro: "As duas senhas novas não são iguais." };
  try {
    const db = getDb();
    const chave = chaveAnonima("senha-gerente", `${gerente.id}:${ipDe(await headers())}`, segredoDeSessao());
    if (!(await consumirLimite(db, chave, 8, 15 * 60))) return { erro: "Muitas tentativas. Aguarde 15 minutos." };
    await trocarSenhaDoGerente(db, gerente.id, texto(fd, "atual"), nova, await tokenDoGerente());
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
  return { ok: "Senha trocada." };
}
