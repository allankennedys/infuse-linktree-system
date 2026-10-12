// BR Code estático (Pix copia e cola), sem valor fixo. Portado do infuse-links.

export type ChavePix = {
  /** Chave no formato exigido pelo BR Code (celular: +55DDDNÚMERO). */
  chave: string;
  /** Até 25 caracteres, sem acento. */
  nome: string;
  /** Até 15 caracteres, sem acento. */
  cidade: string;
};

const campo = (id: string, valor: string) => id + String(valor.length).padStart(2, "0") + valor;

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), em 4 dígitos hexadecimais maiúsculos. */
function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function payloadPix({ chave, nome, cidade }: ChavePix): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave);
  const base =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("58", "BR") +
    campo("59", nome.slice(0, 25)) +
    campo("60", cidade.slice(0, 15)) +
    campo("62", campo("05", "***")) +
    "6304";
  return base + crc16(base);
}

// ---- Chave digitada no painel ----

/** Tamanhos do BR Code para o nome e a cidade de quem recebe. */
export const LIMITES_PIX = { nome: 25, cidade: 15 };
export type TipoDeChavePix = "celular" | "cpf" | "cnpj" | "email" | "aleatoria";

const ALEATORIA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cpfValido(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    return ((soma * 10) % 11) % 10;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** Vale para o CNPJ só de números e para o alfanumérico (cada caractere vale o código ASCII menos 48). */
function cnpjValido(c: string): boolean {
  if (/^(.)\1{13}$/.test(c)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += (c.charCodeAt(i) - 48) * (((n - 1 - i) % 8) + 2);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(c[12]) && digito(13) === Number(c[13]);
}

/**
 * Reconhece o tipo da chave pelo que foi digitado e devolve no formato do BR Code, ou null se
 * não for uma chave Pix. Onze dígitos sem máscara tanto podem ser CPF quanto celular: vale CPF
 * se os dígitos verificadores conferem; para forçar celular, basta digitar com +55 ou com (DDD).
 */
export function lerChavePix(valor: string): { chave: string; tipo: TipoDeChavePix } | null {
  const v = valor.trim();
  if (v.includes("@")) {
    return v.length <= 77 && /^[\x21-\x7e]+@[\x21-\x7e]+\.[\x21-\x7e]+$/.test(v) && v.indexOf("@") === v.lastIndexOf("@")
      ? { chave: v.toLowerCase(), tipo: "email" } : null;
  }
  if (ALEATORIA.test(v)) return { chave: v.toLowerCase(), tipo: "aleatoria" };
  const d = v.replace(/[\s().\-/]/g, "").toUpperCase();
  const celular = (ddi: string) => (/^[1-9]\d9\d{8}$/.test(ddi) ? { chave: `+55${ddi}`, tipo: "celular" as const } : null);
  if (d.startsWith("+")) return d.startsWith("+55") ? celular(d.slice(3)) : null;
  if (/^[0-9A-Z]{12}\d{2}$/.test(d)) return cnpjValido(d) ? { chave: d, tipo: "cnpj" } : null;
  if (/^55\d{11}$/.test(d)) return celular(d.slice(2));
  if (!/^\d{11}$/.test(d)) return null;
  if (!v.includes("(") && cpfValido(d)) return { chave: d, tipo: "cpf" };
  return celular(d);
}

/** Chave já normalizada, do jeito que as pessoas escrevem: (75) 98822-4505, 123.456.789-09. */
export function exibirChavePix(chave: string): string {
  if (/^\+55\d{11}$/.test(chave)) return `(${chave.slice(3, 5)}) ${chave.slice(5, 10)}-${chave.slice(10)}`;
  if (/^\d{11}$/.test(chave)) return `${chave.slice(0, 3)}.${chave.slice(3, 6)}.${chave.slice(6, 9)}-${chave.slice(9)}`;
  if (/^[0-9A-Z]{12}\d{2}$/.test(chave)) {
    return `${chave.slice(0, 2)}.${chave.slice(2, 5)}.${chave.slice(5, 8)}/${chave.slice(8, 12)}-${chave.slice(12)}`;
  }
  return chave;
}

/** Sem acento e só ASCII: é o que o BR Code aceita no nome e na cidade. */
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "").replace(/\s+/g, " ").trim();

/** Valida o que foi digitado para um botão Pix e devolve pronto para gerar o BR Code. */
export function validarPix(e: { chave: string; nome: string; cidade: string }): { ok: true; pix: ChavePix } | { ok: false; erro: string } {
  const L = LIMITES_PIX;
  if (!e.chave.trim()) return { ok: false, erro: "informe a chave Pix." };
  const lida = lerChavePix(e.chave);
  if (!lida) return { ok: false, erro: "chave Pix não reconhecida. Use CPF, CNPJ, celular com DDD, e-mail ou chave aleatória." };
  // O BR Code limita os dois campos; o que passa é cortado, como os apps de banco fazem ("Feira de Santan").
  const nome = semAcento(e.nome).slice(0, L.nome).trim(), cidade = semAcento(e.cidade).slice(0, L.cidade).trim();
  if (!nome) return { ok: false, erro: "informe o nome de quem recebe o Pix." };
  if (!cidade) return { ok: false, erro: "informe a cidade de quem recebe o Pix." };
  return { ok: true, pix: { chave: lida.chave, nome, cidade } };
}
