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
