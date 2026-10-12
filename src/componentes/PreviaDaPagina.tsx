"use client";

import { useEffect, useRef } from "react";
import type { Pagina } from "@/lib/pagina";
import { renderizarPagina, type ImagensDaPagina } from "@/lib/pagina-html";

/** Tamanho de tela simulado: um celular comum. A moldura é só uma redução disso. */
const LARGURA = 390, ALTURA = 780, ESCALA = 0.72;

/**
 * Prévia ao vivo da página de links: o mesmo HTML da página pública, gerado no navegador
 * a partir do que está digitado, dentro de um iframe com tamanho de celular.
 */
type Props = { pagina: Pagina; imagens: ImagensDaPagina; favicons?: Record<string, string> };

export function PreviaDaPagina({ pagina, imagens, favicons }: Props) {
  const quadro = useRef<HTMLIFrameElement>(null);
  const html = renderizarPagina(pagina, imagens, { previa: true, favicons });

  useEffect(() => {
    // Escrever no documento, em vez de trocar o src, atualiza sem recarregar: a imagem de fundo não pisca.
    const escrever = setTimeout(() => {
      const doc = quadro.current?.contentDocument;
      if (!doc) return;
      doc.open();
      doc.write(html);
      doc.close();
    }, 120);
    return () => clearTimeout(escrever);
  }, [html]);

  return (
    <div className="previa-celular" style={{ width: LARGURA * ESCALA, height: ALTURA * ESCALA }}>
      <iframe
        ref={quadro} title="Prévia da página de links" width={LARGURA} height={ALTURA}
        style={{ transform: `scale(${ESCALA})` }}
      />
    </div>
  );
}
