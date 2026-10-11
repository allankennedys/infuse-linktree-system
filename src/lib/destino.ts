import { isIP } from "node:net";

export const TAMANHO_MAXIMO_DESTINO = 2048;

export type OpcoesDestino = {
  /** Lista de hosts permitidos; vazia = qualquer host HTTPS. Aceita "*.dominio.com". */
  hostsPermitidos?: string[];
  /** Só em desenvolvimento: aceita http://localhost. */
  permitirLocal?: boolean;
};

export type ResultadoDestino = { ok: true; url: string; host: string } | { ok: false; erro: string };

const LOCAIS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostPermitido(host: string, lista: string[]): boolean {
  return lista.some((regra) =>
    regra.startsWith("*.") ? host.endsWith(regra.slice(1)) && host.length > regra.length - 1 : host === regra,
  );
}

/**
 * Valida e normaliza um destino. Análise puramente sintática: o servidor nunca
 * acessa o destino (evita SSRF).
 */
export function validarDestino(entrada: string, op: OpcoesDestino = {}): ResultadoDestino {
  const bruto = entrada.trim();
  if (!bruto) return { ok: false, erro: "Informe o destino." };
  if (bruto.length > TAMANHO_MAXIMO_DESTINO) {
    return { ok: false, erro: `O destino passa de ${TAMANHO_MAXIMO_DESTINO} caracteres.` };
  }
  // Espaços, controles e barras invertidas são interpretados de formas diferentes entre navegadores.
  if (/[\s\u0000-\u001f\u007f\\]/.test(bruto)) {
    return { ok: false, erro: "O destino contém espaços ou caracteres inválidos." };
  }
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    return { ok: false, erro: "URL malformada. Use o endereço completo, começando com https://." };
  }
  const local = LOCAIS.has(url.hostname);
  if (url.protocol !== "https:") {
    if (!(url.protocol === "http:" && local && op.permitirLocal)) {
      return { ok: false, erro: "Apenas URLs https:// são aceitas." };
    }
  }
  if (url.username || url.password) {
    return { ok: false, erro: "URLs com usuário ou senha embutidos não são aceitas." };
  }
  const host = url.hostname.toLowerCase();
  if (!host || host.endsWith(".")) return { ok: false, erro: "Host inválido." };
  if (!(local && op.permitirLocal)) {
    if (local || isIP(host.replace(/^\[|\]$/g, "")) !== 0) {
      return { ok: false, erro: "Use um domínio, não um endereço IP ou localhost." };
    }
    if (!host.includes(".")) return { ok: false, erro: "Host inválido: falta o domínio." };
  }
  const lista = op.hostsPermitidos ?? [];
  if (lista.length > 0 && !hostPermitido(host, lista) && !(local && op.permitirLocal)) {
    return { ok: false, erro: `O domínio ${host} não está na lista de domínios permitidos.` };
  }
  const normalizada = url.href;
  if (normalizada.length > TAMANHO_MAXIMO_DESTINO) {
    return { ok: false, erro: `O destino passa de ${TAMANHO_MAXIMO_DESTINO} caracteres.` };
  }
  return { ok: true, url: normalizada, host };
}

/** Host de um destino já salvo, ou null se não for interpretável. */
export function hostDe(destino: string | null | undefined): string | null {
  if (!destino) return null;
  try {
    return new URL(destino).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Domínios comuns como destino de plaquinhas, usados só para detectar imitações.
const CONHECIDOS = [
  "wa.me", "whatsapp.com", "instagram.com", "facebook.com", "google.com", "youtube.com",
  "tiktok.com", "linktr.ee", "mercadopago.com.br", "mercadolivre.com.br", "nubank.com.br",
  "picpay.com", "pagbank.com.br", "ifood.com.br", "infusesoftware.com",
];

function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = linha[0]!;
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const acima = linha[j]!;
      linha[j] = Math.min(acima + 1, linha[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = acima;
    }
  }
  return linha[b.length]!;
}

const semWww = (h: string) => h.replace(/^www\./, "");

/**
 * Alertas não bloqueantes sobre o domínio de destino. `hostsEmUso` são os hosts
 * já configurados em outros códigos do painel.
 */
export function avisosDeDominio(host: string, hostsEmUso: string[]): string[] {
  const avisos: string[] = [];
  const alvo = semWww(host);
  if (host.split(".").some((p) => p.startsWith("xn--"))) {
    avisos.push("O domínio usa caracteres internacionais (punycode), técnica comum em imitações. Confira letra por letra.");
  }
  const emUso = new Set(hostsEmUso.map(semWww));
  const referencias = new Set([...CONHECIDOS, ...emUso]);
  const pertence = [...referencias].some((r) => alvo === r || alvo.endsWith(`.${r}`));
  if (!pertence) {
    for (const r of referencias) {
      const d = distancia(alvo, r);
      if (d > 0 && d <= 2 && r.length >= 6) {
        avisos.push(`O domínio ${host} é muito parecido com ${r}, mas não é igual. Confira se não é uma imitação.`);
        break;
      }
    }
  }
  if (!emUso.has(alvo)) {
    avisos.push(`O domínio ${host} ainda não foi usado em nenhum código deste painel. Confira se é o endereço certo.`);
  }
  return avisos;
}
