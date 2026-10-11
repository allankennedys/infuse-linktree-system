"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdmin, sair } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { configurarCodigo, ErroDeNegocio, obterCodigo, operarCodigo, type Modo, type Operacao } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { baseUrl, ErroDeConfiguracao, hostsPermitidos, permiteDestinoLocal } from "@/lib/env";
import { inteiroPositivo } from "@/lib/formato";
import { gerarLote } from "@/lib/lotes";
import { removerImagem, salvarImagem, TIPOS_DE_IMAGEM, validarImagem, type TipoDeImagem } from "@/lib/pagina";

// Toda action começa por exigirAdmin(): actions são endpoints POST públicos,
// esconder o botão na interface não protege nada.

export type EstadoSimples = { erro?: string; ok?: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "");

function mensagemDe(e: unknown): string {
  if (e instanceof ErroDeNegocio || e instanceof ErroDeConfiguracao) return e.message;
  console.error("[infuse-qr] falha em action:", e instanceof Error ? e.message : "erro desconhecido");
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function acaoGerarLote(_: EstadoSimples, fd: FormData): Promise<EstadoSimples> {
  const admin = await exigirAdmin();
  let loteId: number;
  try {
    const lote = await gerarLote(
      getDb(), { quantidade: Number(texto(fd, "quantidade")), nome: texto(fd, "nome") }, admin, baseUrl());
    loteId = lote.id;
  } catch (e) {
    revalidatePath("/lotes");
    return { erro: mensagemDe(e) };
  }
  revalidatePath("/", "layout");
  redirect(`/lotes/${loteId}`);
}

export type EstadoConfiguracao =
  | { tipo: "inicial" }
  | { tipo: "erro"; erro: string }
  | { tipo: "confirmar"; reassociacao: boolean; avisos: string[] }
  | { tipo: "salvo"; modo: Modo; destino: string | null };

export async function acaoConfigurar(_: EstadoConfiguracao, fd: FormData): Promise<EstadoConfiguracao> {
  const admin = await exigirAdmin();
  const id = inteiroPositivo(texto(fd, "id"));
  if (!id) return { tipo: "erro", erro: "Código inválido." };
  const modo: Modo = texto(fd, "modo") === "PAGINA" ? "PAGINA" : "LINK";
  const lista = (campo: string) => fd.getAll(campo).map(String);
  const [rotulos, urls, icones] = [lista("link_rotulo"), lista("link_url"), lista("link_icone")];
  try {
    const r = await configurarCodigo(
      getDb(), id,
      {
        destino: texto(fd, "destino"), cliente: texto(fd, "cliente"), notas: texto(fd, "notas"),
        modo,
        pagina: modo === "PAGINA" ? {
          titulo: texto(fd, "p_titulo"), subtitulo: texto(fd, "p_subtitulo"), subtitulo_url: texto(fd, "p_subtitulo_url"),
          rodape: texto(fd, "p_rodape"), cor_fundo: texto(fd, "p_cor_fundo"), cor_destaque: texto(fd, "p_cor_destaque"),
          links: rotulos.slice(0, 50).map((rotulo, i) => ({ rotulo, url: urls[i] ?? "", icone: icones[i] ?? "link" })),
        } : undefined,
        confirmarReassociacao: fd.get("confirmarReassociacao") === "on",
        confirmarAvisos: fd.get("confirmarAvisos") === "on",
      },
      admin, { hostsPermitidos: hostsPermitidos(), permitirLocal: permiteDestinoLocal() },
    );
    if (r.tipo !== "salvo") return r;
    revalidatePath("/", "layout");
    return { tipo: "salvo", modo: r.codigo.modo, destino: r.codigo.destino };
  } catch (e) {
    return { tipo: "erro", erro: mensagemDe(e) };
  }
}

const OPERACOES: Record<Operacao, string> = {
  desativar: "Código desativado. O QR não redireciona mais.",
  reativar: "Código reativado.",
  arquivar: "Código arquivado.",
  desarquivar: "Código desarquivado. Ele volta como desativado; reative quando quiser.",
  "limpar-dados": "Dados do cliente removidos.",
};

export async function acaoOperar(_: EstadoSimples, fd: FormData): Promise<EstadoSimples> {
  const admin = await exigirAdmin();
  const id = inteiroPositivo(texto(fd, "id"));
  const operacao = texto(fd, "operacao") as Operacao;
  if (!id || !(operacao in OPERACOES)) return { erro: "Operação inválida." };
  try {
    await operarCodigo(getDb(), id, operacao, admin, fd.get("confirmar") === "on");
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
  revalidatePath("/", "layout");
  return { ok: OPERACOES[operacao] };
}

/** Envia (com arquivo) ou remove (campo "remover") o logo ou o fundo da página de links. */
export async function acaoImagem(_: EstadoSimples, fd: FormData): Promise<EstadoSimples> {
  const admin = await exigirAdmin();
  const id = inteiroPositivo(texto(fd, "id"));
  const tipo = texto(fd, "tipo") as TipoDeImagem;
  if (!id || !TIPOS_DE_IMAGEM.includes(tipo)) return { erro: "Pedido inválido." };
  try {
    const db = getDb();
    const codigo = await obterCodigo(db, id);
    if (!codigo) return { erro: "Código não encontrado." };
    if (codigo.status === "ARQUIVADO") return { erro: "Código arquivado. Desarquive antes de alterar." };
    const nome = tipo === "logo" ? "Logo" : "Imagem de fundo";
    if (fd.get("remover") === "1") {
      if (await removerImagem(db, id, tipo)) {
        await registrar(db, { adminId: admin.id, codigoId: id, acao: "IMAGEM_ALTERADA", meta: { tipo, removida: true } });
      }
      revalidatePath("/", "layout");
      return { ok: `${nome} removida.` };
    }
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File)) return { erro: "Escolha um arquivo de imagem." };
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    const v = validarImagem(tipo, dados);
    if (!v.ok) return { erro: v.erro };
    await salvarImagem(db, id, tipo, v.mime, dados);
    await registrar(db, { adminId: admin.id, codigoId: id, acao: "IMAGEM_ALTERADA", meta: { tipo } });
    revalidatePath("/", "layout");
    return { ok: `${nome} salva.` };
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
}

export async function acaoSair(): Promise<void> {
  await sair();
  redirect("/login");
}
