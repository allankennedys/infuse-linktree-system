import { randomInt } from "node:crypto";

// Sem 0/O, 1/l/I: o token aparece em nomes de arquivo e pode ser lido por pessoas.
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const TAMANHO_TOKEN = 12; // 56^12 ≈ 2^69,7 combinações

export const FORMATO_TOKEN = /^[2-9A-HJ-NP-Za-km-z]{12}$/;

/** Token público aleatório (CSPRNG, sem viés de módulo). */
export function gerarToken(): string {
  let t = "";
  for (let i = 0; i < TAMANHO_TOKEN; i++) t += ALFABETO[randomInt(ALFABETO.length)];
  return t;
}

/** Gera `n` tokens distintos entre si. */
export function gerarTokens(n: number): string[] {
  const conjunto = new Set<string>();
  while (conjunto.size < n) conjunto.add(gerarToken());
  return [...conjunto];
}

export function urlPublica(base: string, token: string): string {
  return `${base}/q/${token}`;
}

/** Número de inventário amigável, ex.: IQ-000042. */
export function formatarNumero(numero: number): string {
  return `IQ-${String(numero).padStart(6, "0")}`;
}

/** Identificador curto usado só em nomes de arquivo e conferência. */
export function idCurto(token: string): string {
  return token.slice(0, 6);
}
