import { zipSync } from "fflate";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { gerarPng } from "./qr";
import { formatarNumero, idCurto, urlPublica } from "./token";

export type ItemExportacao = { numero: number; token: string; status: string };

export function nomeDoArquivo(item: { numero: number; token: string }): string {
  return `${formatarNumero(item.numero)}_${idCurto(item.token)}.png`;
}

export function gerarZip(itens: ItemExportacao[], base: string, comLegenda: boolean): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {};
  for (const item of itens) {
    arquivos[nomeDoArquivo(item)] = gerarPng(urlPublica(base, item.token), {
      tamanho: 1024,
      legenda: comLegenda ? formatarNumero(item.numero) : undefined,
    });
  }
  // PNG já é comprimido; nível 0 só empacota.
  return zipSync(arquivos, { level: 0 });
}

function celulaCsv(valor: string): string {
  // Neutraliza fórmulas ao abrir em planilhas.
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

/** CSV de conferência: só número interno, lote, URL pública e status. */
export function gerarCsv(itens: ItemExportacao[], base: string, lote: string): string {
  const linhas = [["numero", "lote", "url_publica", "status"].join(",")];
  for (const item of itens) {
    linhas.push([formatarNumero(item.numero), lote, urlPublica(base, item.token), item.status].map(celulaCsv).join(","));
  }
  return `﻿${linhas.join("\r\n")}\r\n`;
}

export const LAYOUTS = {
  grade: { rotulo: "A4 — 12 por página (55 mm)", colunas: 3, linhas: 4, qrMm: 55 },
  etiquetas: { rotulo: "A4 — 24 etiquetas (38 mm)", colunas: 4, linhas: 6, qrMm: 38 },
  plaquinha: { rotulo: "A4 — 1 por página (120 mm)", colunas: 1, linhas: 1, qrMm: 120 },
} as const;
export type Layout = keyof typeof LAYOUTS;

const MM = 72 / 25.4;
const A4 = { largura: 210 * MM, altura: 297 * MM };
const MARGEM = 10 * MM;

// As fontes padrão do PDF só cobrem Latin-1.
const latin1 = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, "?");

export type OpcoesPdf = { layout: Layout; comLegenda: boolean; comGuias: boolean; lote: string };

/**
 * PDF A4 com dimensões fixas em milímetros (imprimir em 100%, sem "ajustar à página"),
 * seguido de páginas de conferência com o inventário.
 */
export async function gerarPdf(itens: ItemExportacao[], base: string, op: OpcoesPdf): Promise<Uint8Array> {
  const { colunas, linhas, qrMm } = LAYOUTS[op.layout];
  const pdf = await PDFDocument.create();
  pdf.setTitle(latin1(`Infuse QR - ${op.lote}`));
  pdf.setCreator("Infuse QR");
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const larguraCelula = (A4.largura - 2 * MARGEM) / colunas;
  const alturaCelula = (A4.altura - 2 * MARGEM) / linhas;
  const lado = qrMm * MM;
  const corpoLegenda = Math.max(7, Math.min(14, lado / 12));
  const alturaLegenda = op.comLegenda ? corpoLegenda * 1.6 : 0;
  const porPagina = colunas * linhas;
  const cinza = rgb(0.75, 0.75, 0.75);

  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]!;
    const posicao = i % porPagina;
    const pagina = posicao === 0 ? pdf.addPage([A4.largura, A4.altura]) : pdf.getPages().at(-1)!;
    const coluna = posicao % colunas;
    const linha = Math.floor(posicao / colunas);
    const x0 = MARGEM + coluna * larguraCelula;
    const yTopo = A4.altura - MARGEM - linha * alturaCelula;

    if (op.comGuias && porPagina > 1) {
      pagina.drawRectangle({
        x: x0, y: yTopo - alturaCelula, width: larguraCelula, height: alturaCelula,
        borderColor: cinza, borderWidth: 0.3,
      });
    }
    const imagem = await pdf.embedPng(gerarPng(urlPublica(base, item.token), { tamanho: 600 }));
    const x = x0 + (larguraCelula - lado) / 2;
    const y = yTopo - (alturaCelula - lado - alturaLegenda) / 2 - lado;
    pagina.drawImage(imagem, { x, y, width: lado, height: lado });
    if (op.comLegenda) {
      const texto = formatarNumero(item.numero);
      const largura = negrito.widthOfTextAtSize(texto, corpoLegenda);
      pagina.drawText(texto, {
        x: x0 + (larguraCelula - largura) / 2, y: y - corpoLegenda * 1.1, size: corpoLegenda, font: negrito,
      });
    }
  }

  // Conferência: inventário de tudo que foi impresso.
  const LINHAS_POR_PAGINA = 44;
  for (let inicio = 0; inicio < itens.length; inicio += LINHAS_POR_PAGINA) {
    const pagina = pdf.addPage([A4.largura, A4.altura]);
    let y = A4.altura - MARGEM - 14;
    pagina.drawText(latin1(`Conferência - ${op.lote}`), { x: MARGEM, y, size: 14, font: negrito });
    y -= 16;
    pagina.drawText(
      latin1(`${itens.length} códigos · ${base} · folha de conferência interna, não entregar ao cliente`),
      { x: MARGEM, y, size: 8, font: fonte, color: rgb(0.35, 0.35, 0.35) },
    );
    y -= 22;
    const colunasX = [MARGEM, MARGEM + 80, MARGEM + 150];
    ["Nº inventário", "ID curto", "URL pública codificada"].forEach((t, k) =>
      pagina.drawText(latin1(t), { x: colunasX[k]!, y, size: 9, font: negrito }),
    );
    y -= 6;
    pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4.largura - MARGEM, y }, thickness: 0.5, color: cinza });
    for (const item of itens.slice(inicio, inicio + LINHAS_POR_PAGINA)) {
      y -= 16;
      const celulas = [formatarNumero(item.numero), idCurto(item.token), urlPublica(base, item.token)];
      celulas.forEach((t, k) => pagina.drawText(latin1(t), { x: colunasX[k]!, y, size: 9, font: fonte }));
    }
  }
  return pdf.save();
}
