import QRCode from "qrcode";
import { PNG } from "pngjs";
import jsqrModulo from "jsqr";

// jsQR é CommonJS; dependendo do carregador o default vem embrulhado.
type JsQr = (dados: Uint8ClampedArray, largura: number, altura: number) => { data: string } | null;
const jsQR: JsQr = ((jsqrModulo as unknown as { default?: JsQr }).default ?? jsqrModulo) as JsQr;

/** Módulos de margem branca em cada lado (mínimo da especificação: 4). */
export const ZONA_SILENCIOSA = 4;
// Q (~25% de recuperação): plaquinhas físicas riscam e desbotam.
const CORRECAO = "Q" as const;

export type Raster = { largura: number; altura: number; dados: Uint8ClampedArray };

// Fonte bitmap 5x7 embutida: a legenda não depende de fontes instaladas no servidor.
const GLIFOS: Record<string, string> = {
  "0": "01110,10001,10011,10101,11001,10001,01110",
  "1": "00100,01100,00100,00100,00100,00100,01110",
  "2": "01110,10001,00001,00010,00100,01000,11111",
  "3": "11110,00001,00001,01110,00001,00001,11110",
  "4": "00010,00110,01010,10010,11111,00010,00010",
  "5": "11111,10000,11110,00001,00001,10001,01110",
  "6": "00110,01000,10000,11110,10001,10001,01110",
  "7": "11111,00001,00010,00100,01000,01000,01000",
  "8": "01110,10001,10001,01110,10001,10001,01110",
  "9": "01110,10001,10001,01111,00001,00010,01100",
  A: "01110,10001,10001,11111,10001,10001,10001",
  B: "11110,10001,10001,11110,10001,10001,11110",
  C: "01110,10001,10000,10000,10000,10001,01110",
  D: "11110,10001,10001,10001,10001,10001,11110",
  E: "11111,10000,10000,11110,10000,10000,11111",
  F: "11111,10000,10000,11110,10000,10000,10000",
  G: "01110,10001,10000,10111,10001,10001,01111",
  H: "10001,10001,10001,11111,10001,10001,10001",
  I: "01110,00100,00100,00100,00100,00100,01110",
  J: "00111,00010,00010,00010,00010,10010,01100",
  K: "10001,10010,10100,11000,10100,10010,10001",
  L: "10000,10000,10000,10000,10000,10000,11111",
  M: "10001,11011,10101,10101,10001,10001,10001",
  N: "10001,11001,10101,10011,10001,10001,10001",
  O: "01110,10001,10001,10001,10001,10001,01110",
  P: "11110,10001,10001,11110,10000,10000,10000",
  Q: "01110,10001,10001,10001,10101,10010,01101",
  R: "11110,10001,10001,11110,10100,10010,10001",
  S: "01111,10000,10000,01110,00001,00001,11110",
  T: "11111,00100,00100,00100,00100,00100,00100",
  U: "10001,10001,10001,10001,10001,10001,01110",
  V: "10001,10001,10001,10001,10001,01010,00100",
  W: "10001,10001,10001,10101,10101,11011,10001",
  X: "10001,10001,01010,00100,01010,10001,10001",
  Y: "10001,10001,01010,00100,00100,00100,00100",
  Z: "11111,00001,00010,00100,01000,10000,11111",
  "-": "00000,00000,00000,11111,00000,00000,00000",
};

function pintar(r: Raster, x0: number, y0: number, w: number, h: number) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * r.largura + x) * 4;
      r.dados[i] = 0;
      r.dados[i + 1] = 0;
      r.dados[i + 2] = 0;
    }
  }
}

export type OpcoesQr = {
  /** Largura alvo em pixels (o resultado é o maior múltiplo inteiro de módulos que cabe). */
  tamanho?: number;
  /** Texto abaixo do código, fora da área de leitura e da zona silenciosa. */
  legenda?: string;
};

/** Desenha o QR em preto puro sobre branco, sem nada dentro da área de leitura. */
export function rasterizarQr(conteudo: string, op: OpcoesQr = {}): Raster {
  const qr = QRCode.create(conteudo, { errorCorrectionLevel: CORRECAO });
  const n = qr.modules.size;
  const total = n + ZONA_SILENCIOSA * 2;
  const escala = Math.max(1, Math.floor((op.tamanho ?? 1024) / total));
  const largura = total * escala;

  const texto = (op.legenda ?? "").toUpperCase().replace(/[^0-9A-Z-]/g, "").slice(0, 24);
  const pixel = texto ? Math.max(1, Math.floor((largura * 0.5) / (texto.length * 6 - 1))) : 0;
  const altura = largura + (texto ? 7 * pixel + 2 * escala : 0);

  const r: Raster = { largura, altura, dados: new Uint8ClampedArray(largura * altura * 4).fill(255) };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.data[y * n + x]) {
        pintar(r, (x + ZONA_SILENCIOSA) * escala, (y + ZONA_SILENCIOSA) * escala, escala, escala);
      }
    }
  }
  if (texto) {
    const larguraTexto = (texto.length * 6 - 1) * pixel;
    let x = Math.floor((largura - larguraTexto) / 2);
    for (const letra of texto) {
      const linhas = (GLIFOS[letra] ?? "").split(",");
      linhas.forEach((linha, ly) => {
        for (let lx = 0; lx < linha.length; lx++) {
          if (linha[lx] === "1") pintar(r, x + lx * pixel, largura + ly * pixel, pixel, pixel);
        }
      });
      x += 6 * pixel;
    }
  }
  return r;
}

/** QR em SVG inline (um módulo por unidade, sem margem), para exibir em tela sobre fundo branco. */
export function gerarSvg(conteudo: string): string {
  const qr = QRCode.create(conteudo, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) if (qr.modules.data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
  }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true"><path fill="#000" d="${d}"/></svg>`;
}

export function rasterParaPng(r: Raster): Buffer {
  const png = new PNG({ width: r.largura, height: r.altura });
  png.data = Buffer.from(r.dados.buffer, r.dados.byteOffset, r.dados.byteLength);
  return PNG.sync.write(png, { colorType: 0 });
}

export function gerarPng(conteudo: string, op: OpcoesQr = {}): Buffer {
  return rasterParaPng(rasterizarQr(conteudo, op));
}

/** Lê um QR a partir de pixels RGBA. Retorna o texto ou null. */
export function decodificarRaster(r: Raster): string | null {
  return jsQR(r.dados, r.largura, r.altura)?.data ?? null;
}

export function decodificarPng(png: Uint8Array): string | null {
  const img = PNG.sync.read(Buffer.from(png));
  return decodificarRaster({
    largura: img.width,
    altura: img.height,
    dados: new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength),
  });
}

/** Gera o QR de `conteudo` e lê de volta. Usado para validar o lote antes de liberar. */
export function gerarEDecodificar(conteudo: string): string | null {
  return decodificarRaster(rasterizarQr(conteudo, { tamanho: 6 * 60 }));
}
