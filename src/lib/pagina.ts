import type { Db } from "./db";
import { validarDestino, type OpcoesDestino } from "./destino";
import { ehIcone } from "./icones";
import { validarPix, type ChavePix } from "./pix";

export const LIMITES_PAGINA = { links: 12, titulo: 60, subtitulo: 60, rodape: 80, rotulo: 40 };
export const PADRAO_PAGINA = { cor_fundo: "#030305", cor_destaque: "#2f7bff", fundo_opacidade: 100 };

/** Botão Pix (ícone "pix"): `url` fica vazia e `pix` traz a chave; ele abre o QR Code em vez de um endereço. */
export type LinkDaPagina = { rotulo: string; url: string; icone: string; pix?: ChavePix };
/** Botão como chega do formulário. Os campos `pix_*` só contam quando o ícone é "pix". */
export type EntradaLink = { rotulo: string; url: string; icone: string; pix_chave?: string; pix_nome?: string; pix_cidade?: string };
export type Pagina = {
  titulo: string; subtitulo: string | null; subtitulo_url: string | null; rodape: string | null;
  cor_fundo: string; cor_destaque: string; links: LinkDaPagina[];
  /** Opacidade da imagem de fundo, de 0 a 100 (%). Ausente = 100. */
  fundo_opacidade?: number;
};
/** O que chega do formulário, ainda sem validar. */
export type EntradaPagina = {
  titulo: string; subtitulo: string; subtitulo_url: string; rodape: string;
  cor_fundo: string; cor_destaque: string; links: EntradaLink[];
  /** Vazio ou ausente = 100. */
  fundo_opacidade?: string;
};

const COR = /^#[0-9a-f]{6}$/;

/** Valida e normaliza a página. Todos os endereços passam pela mesma regra dos destinos. */
export function validarPagina(e: EntradaPagina, op: OpcoesDestino = {}): { ok: true; pagina: Pagina } | { ok: false; erro: string } {
  const L = LIMITES_PAGINA;
  const titulo = e.titulo.trim();
  const subtitulo = e.subtitulo.trim() || null;
  const rodape = e.rodape.trim() || null;
  if (!titulo) return { ok: false, erro: "Informe o nome que aparece no topo da página." };
  if (titulo.length > L.titulo) return { ok: false, erro: `Nome da página: máximo de ${L.titulo} caracteres.` };
  if (subtitulo && subtitulo.length > L.subtitulo) return { ok: false, erro: `Subtítulo: máximo de ${L.subtitulo} caracteres.` };
  if (rodape && rodape.length > L.rodape) return { ok: false, erro: `Rodapé: máximo de ${L.rodape} caracteres.` };

  const cor_fundo = e.cor_fundo.trim().toLowerCase() || PADRAO_PAGINA.cor_fundo;
  const cor_destaque = e.cor_destaque.trim().toLowerCase() || PADRAO_PAGINA.cor_destaque;
  if (!COR.test(cor_fundo) || !COR.test(cor_destaque)) return { ok: false, erro: "Cor inválida. Use o formato #rrggbb." };
  const opacidade = (e.fundo_opacidade ?? "").trim();
  const fundo_opacidade = opacidade ? Number(opacidade) : PADRAO_PAGINA.fundo_opacidade;
  if (!Number.isInteger(fundo_opacidade) || fundo_opacidade < 0 || fundo_opacidade > 100) {
    return { ok: false, erro: "Opacidade da imagem de fundo: use um número de 0 a 100." };
  }

  let subtitulo_url: string | null = null;
  if (e.subtitulo_url.trim()) {
    if (!subtitulo) return { ok: false, erro: "Para usar o link do subtítulo, preencha o subtítulo." };
    const v = validarDestino(e.subtitulo_url, op);
    if (!v.ok) return { ok: false, erro: `Link do subtítulo: ${v.erro}` };
    subtitulo_url = v.url;
  }

  // Linha totalmente vazia é ignorada (o admin adicionou e não preencheu).
  const ehPix = (l: EntradaLink) => l.icone === "pix";
  const preenchidos = e.links.filter((l) => l.rotulo.trim() || (ehPix(l) ? l.pix_chave?.trim() : l.url.trim()));
  if (preenchidos.length === 0) return { ok: false, erro: "Adicione pelo menos um link à página." };
  if (preenchidos.length > L.links) return { ok: false, erro: `Máximo de ${L.links} links por página.` };
  // O QR do Pix abre num painel único da página.
  if (preenchidos.filter(ehPix).length > 1) return { ok: false, erro: "Só um botão da página pode ser Pix." };
  const links: LinkDaPagina[] = [];
  for (const [i, l] of preenchidos.entries()) {
    const rotulo = l.rotulo.trim();
    if (!rotulo) return { ok: false, erro: `Link ${i + 1}: informe o texto do botão.` };
    if (rotulo.length > L.rotulo) return { ok: false, erro: `Link ${i + 1}: texto com no máximo ${L.rotulo} caracteres.` };
    if (ehPix(l)) {
      const v = validarPix({ chave: l.pix_chave ?? "", nome: l.pix_nome ?? "", cidade: l.pix_cidade ?? "" });
      if (!v.ok) return { ok: false, erro: `Link ${i + 1} (${rotulo}): ${v.erro}` };
      links.push({ rotulo, url: "", icone: "pix", pix: v.pix });
      continue;
    }
    const v = validarDestino(l.url, op);
    if (!v.ok) return { ok: false, erro: `Link ${i + 1} (${rotulo}): ${v.erro}` };
    links.push({ rotulo, url: v.url, icone: ehIcone(l.icone) ? l.icone : "link" });
  }
  return { ok: true, pagina: { titulo, subtitulo, subtitulo_url, rodape, cor_fundo, cor_destaque, fundo_opacidade, links } };
}

export async function obterPagina(db: Db, codigoId: number): Promise<Pagina | null> {
  const p = await db.query<Omit<Pagina, "links">>(
    "select titulo, subtitulo, subtitulo_url, rodape, cor_fundo, cor_destaque, fundo_opacidade from paginas where codigo_id = $1",
    [codigoId]);
  if (!p.rows[0]) return null;
  const links = await db.query<{ rotulo: string; url: string; icone: string; pix_chave: string | null; pix_nome: string | null; pix_cidade: string | null }>(
    "select rotulo, url, icone, pix_chave, pix_nome, pix_cidade from pagina_links where codigo_id = $1 order by posicao", [codigoId]);
  return {
    ...p.rows[0],
    links: links.rows.map(({ pix_chave, pix_nome, pix_cidade, ...l }): LinkDaPagina =>
      pix_chave ? { ...l, pix: { chave: pix_chave, nome: pix_nome ?? "", cidade: pix_cidade ?? "" } } : l),
  };
}

export async function salvarPagina(db: Db, codigoId: number, p: Pagina): Promise<void> {
  await db.query(
    `insert into paginas (codigo_id, titulo, subtitulo, subtitulo_url, rodape, cor_fundo, cor_destaque, fundo_opacidade)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (codigo_id) do update set titulo = excluded.titulo, subtitulo = excluded.subtitulo,
       subtitulo_url = excluded.subtitulo_url, rodape = excluded.rodape, cor_fundo = excluded.cor_fundo,
       cor_destaque = excluded.cor_destaque, fundo_opacidade = excluded.fundo_opacidade, atualizado_em = now()`,
    [codigoId, p.titulo, p.subtitulo, p.subtitulo_url, p.rodape, p.cor_fundo, p.cor_destaque,
      p.fundo_opacidade ?? PADRAO_PAGINA.fundo_opacidade]);
  await db.query("delete from pagina_links where codigo_id = $1", [codigoId]);
  for (const [i, l] of p.links.entries()) {
    await db.query(
      "insert into pagina_links (codigo_id, posicao, rotulo, url, icone, pix_chave, pix_nome, pix_cidade) values ($1, $2, $3, $4, $5, $6, $7, $8)",
      [codigoId, i, l.rotulo, l.url, l.icone, l.pix?.chave ?? null, l.pix?.nome ?? null, l.pix?.cidade ?? null]);
  }
}

/** Botões enviados pelo formulário de configuração: os campos se repetem, um conjunto por botão, na mesma ordem. */
export function linksDoFormulario(fd: FormData): EntradaLink[] {
  const lista = (campo: string) => fd.getAll(campo).map(String);
  const [urls, icones] = [lista("link_url"), lista("link_icone")];
  const [chaves, nomes, cidades] = [lista("link_pix_chave"), lista("link_pix_nome"), lista("link_pix_cidade")];
  return lista("link_rotulo").slice(0, 50).map((rotulo, i) => ({
    rotulo, url: urls[i] ?? "", icone: icones[i] ?? "link",
    pix_chave: chaves[i] ?? "", pix_nome: nomes[i] ?? "", pix_cidade: cidades[i] ?? "",
  }));
}

// ---- Imagens (logo e fundo) ----

export const TIPOS_DE_IMAGEM = ["logo", "fundo"] as const;
export type TipoDeImagem = (typeof TIPOS_DE_IMAGEM)[number];
export const TAMANHO_MAXIMO_IMAGEM: Record<TipoDeImagem, number> = { logo: 600 * 1024, fundo: 2 * 1024 * 1024 };

/** Identifica o formato pelos primeiros bytes, não pelo nome nem pelo tipo declarado. SVG não é aceito. */
export function detectarMime(b: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  const inicio = (assinatura: number[], desloc = 0) => assinatura.every((v, i) => b[desloc + i] === v);
  if (inicio([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (inicio([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (inicio([0x52, 0x49, 0x46, 0x46]) && inicio([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function validarImagem(tipo: TipoDeImagem, dados: Uint8Array): { ok: true; mime: string } | { ok: false; erro: string } {
  if (dados.length === 0) return { ok: false, erro: "Escolha um arquivo de imagem." };
  const limite = TAMANHO_MAXIMO_IMAGEM[tipo];
  if (dados.length > limite) return { ok: false, erro: `Imagem grande demais: o limite é ${Math.round(limite / 1024)} KB.` };
  const mime = detectarMime(dados);
  if (!mime) return { ok: false, erro: "Formato não aceito. Envie PNG, JPG ou WebP." };
  return { ok: true, mime };
}

export async function salvarImagem(db: Db, codigoId: number, tipo: TipoDeImagem, mime: string, dados: Uint8Array) {
  await db.query(
    `insert into imagens (codigo_id, tipo, mime, dados) values ($1, $2, $3, $4)
     on conflict (codigo_id, tipo) do update set mime = excluded.mime, dados = excluded.dados, atualizado_em = now()`,
    [codigoId, tipo, mime, Buffer.from(dados)]);
}

export async function removerImagem(db: Db, codigoId: number, tipo: TipoDeImagem): Promise<boolean> {
  return (await db.query("delete from imagens where codigo_id = $1 and tipo = $2", [codigoId, tipo])).rowCount > 0;
}

export async function obterImagem(db: Db, codigoId: number, tipo: TipoDeImagem) {
  const { rows } = await db.query<{ mime: string; dados: Uint8Array }>(
    "select mime, dados from imagens where codigo_id = $1 and tipo = $2", [codigoId, tipo]);
  return rows[0] ?? null;
}

/** Versão de cada imagem existente, para compor URLs que mudam quando a imagem muda. */
export async function versoesDasImagens(db: Db, codigoId: number): Promise<Partial<Record<TipoDeImagem, number>>> {
  const { rows } = await db.query<{ tipo: TipoDeImagem; v: number }>(
    "select tipo, extract(epoch from atualizado_em)::int as v from imagens where codigo_id = $1", [codigoId]);
  return Object.fromEntries(rows.map((r) => [r.tipo, r.v]));
}
