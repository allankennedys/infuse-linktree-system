// Separado de qr.ts porque também roda no navegador (prévia ao vivo): nada de APIs do Node aqui.
import QRCode from "qrcode";

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
