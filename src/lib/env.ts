// Leitura centralizada das variáveis de ambiente. Nada aqui tem valor padrão
// para URL pública, banco ou segredos: se faltar, a operação falha com erro claro.

export class ErroDeConfiguracao extends Error {}

const emProducao = () => process.env.NODE_ENV === "production";

/** Valida e normaliza uma URL base pública (sem barra final, sem caminho). */
export function normalizarBaseUrl(valor: string | undefined, producao = emProducao()): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) {
    throw new ErroDeConfiguracao("APP_BASE_URL não está definida. Configure a URL pública oficial antes de gerar QR Codes.");
  }
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    throw new ErroDeConfiguracao("APP_BASE_URL não é uma URL válida.");
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !producao)) {
    throw new ErroDeConfiguracao("APP_BASE_URL precisa usar https.");
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new ErroDeConfiguracao("APP_BASE_URL deve conter apenas protocolo e host, sem caminho, query ou credenciais.");
  }
  return url.origin;
}

export function baseUrl(): string {
  return normalizarBaseUrl(process.env.APP_BASE_URL);
}

export function segredoDeSessao(): string {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) {
    throw new ErroDeConfiguracao("SESSION_SECRET precisa ter pelo menos 32 caracteres.");
  }
  return s;
}

export function hostsPermitidos(): string[] {
  return (process.env.DESTINATION_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export function permiteDestinoLocal(): boolean {
  return !emProducao() && process.env.ALLOW_INSECURE_LOCAL_DESTINATIONS === "true";
}

function inteiro(nome: string, padrao: number): number {
  const n = Number.parseInt(process.env[nome] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : padrao;
}

export const retencaoAcessosDias = () => inteiro("SCAN_RETENTION_DAYS", 90);
export const retencaoAuditoriaDias = () => inteiro("AUDIT_RETENTION_DAYS", 730);
export const poolMax = () => inteiro("DATABASE_POOL_MAX", 3);
export { emProducao };
