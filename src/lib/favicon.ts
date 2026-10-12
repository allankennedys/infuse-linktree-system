import { isIP } from "node:net";
import type { Db } from "./db";
import type { Pagina } from "./pagina";

// O servidor nunca acessa o site de destino (evita SSRF). O favicon vem de serviços públicos
// de endereço fixo, que recebem só o nome do domínio; a cópia fica no banco.
const FONTES = [
  (host: string) => `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
  (host: string) => `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
];
const TAMANHO_MAXIMO = 300 * 1024;
const PRAZO_MS = 4000;
/** Host sem favicon é procurado de novo depois deste prazo. */
const NOVA_TENTATIVA_DIAS = 7;
const MAXIMO_POR_VEZ = 20;

export type Favicon = { mime: string; dados: Uint8Array };
export type Buscar = (url: string, init: { signal: AbortSignal; redirect: "follow" }) => Promise<Response>;

/** Só nomes de domínio públicos: nada de IP, localhost ou host sem ponto. */
export function hostDeFaviconValido(host: string): boolean {
  return host.length <= 253 && /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host) && isIP(host) === 0;
}

/** Formato pelos primeiros bytes. SVG fica de fora: servido do nosso domínio, poderia executar script. */
export function detectarImagemDeFavicon(b: Uint8Array): string | null {
  const inicio = (assinatura: number[], desloc = 0) => assinatura.every((v, i) => b[desloc + i] === v);
  if (inicio([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (inicio([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (inicio([0x52, 0x49, 0x46, 0x46]) && inicio([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (inicio([0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (inicio([0x00, 0x00, 0x01, 0x00])) return "image/x-icon";
  return null;
}

/** Tenta cada serviço, com e sem "www.". Os serviços respondem 404 quando não conhecem o site. */
export async function baixarFavicon(host: string, buscar: Buscar = fetch): Promise<Favicon | null> {
  if (!hostDeFaviconValido(host)) return null;
  const alternativo = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  for (const nome of [host, alternativo]) {
    if (!hostDeFaviconValido(nome)) continue;
    for (const fonte of FONTES) {
      try {
        const r = await buscar(fonte(nome), { signal: AbortSignal.timeout(PRAZO_MS), redirect: "follow" });
        if (r.status !== 200) continue;
        const dados = new Uint8Array(await r.arrayBuffer());
        if (dados.length === 0 || dados.length > TAMANHO_MAXIMO) continue;
        const mime = detectarImagemDeFavicon(dados);
        if (mime) return { mime, dados };
      } catch {
        // Serviço fora do ar ou lento: tenta o próximo.
      }
    }
  }
  return null;
}

export async function obterFavicon(db: Db, host: string): Promise<Favicon | null> {
  const { rows } = await db.query<Favicon>("select mime, dados from favicons where host = $1 and dados is not null", [host]);
  return rows[0] ?? null;
}

export async function salvarFavicon(db: Db, host: string, favicon: Favicon | null): Promise<void> {
  await db.query(
    `insert into favicons (host, mime, dados) values ($1, $2, $3)
     on conflict (host) do update set mime = excluded.mime, dados = excluded.dados, buscado_em = now()`,
    [host, favicon?.mime ?? null, favicon ? Buffer.from(favicon.dados) : null]);
}

/** Hosts dos botões com o ícone genérico "Link": são os que trocam o ícone pelo favicon do site. */
export function hostsComIconeDeLink(pagina: Pick<Pagina, "links">): string[] {
  const hosts = pagina.links.filter((l) => l.icone === "link").map((l) => {
    try {
      const u = new URL(l.url);
      return u.protocol === "https:" ? u.hostname.toLowerCase() : "";
    } catch {
      return "";
    }
  });
  return [...new Set(hosts)].filter(hostDeFaviconValido).slice(0, MAXIMO_POR_VEZ);
}

/** Busca e guarda o favicon dos hosts que ainda não têm (ou cuja última busca sem resultado já venceu). */
export async function garantirFavicons(db: Db, hosts: string[], buscar: Buscar = fetch): Promise<void> {
  if (hosts.length === 0) return;
  const { rows } = await db.query<{ host: string }>(
    `select host from favicons where host = any($1::text[])
        and (dados is not null or buscado_em > now() - make_interval(days => $2))`,
    [hosts, NOVA_TENTATIVA_DIAS]);
  const resolvidos = new Set(rows.map((r) => r.host));
  await Promise.all(hosts.filter((h) => !resolvidos.has(h)).map(async (host) => {
    await salvarFavicon(db, host, await baixarFavicon(host, buscar));
  }));
}

/** Endereço do favicon guardado de cada host da página; host sem favicon fica de fora (ícone genérico). */
export async function faviconsDaPagina(db: Db, pagina: Pick<Pagina, "links">): Promise<Record<string, string>> {
  const hosts = hostsComIconeDeLink(pagina);
  if (hosts.length === 0) return {};
  const { rows } = await db.query<{ host: string; v: number }>(
    "select host, extract(epoch from buscado_em)::int as v from favicons where host = any($1::text[]) and dados is not null",
    [hosts]);
  return Object.fromEntries(rows.map((r) => [r.host, `/icone/${r.host}?v=${r.v}`]));
}
