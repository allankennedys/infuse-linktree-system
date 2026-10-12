import type { Db } from "./db";
import { registrarAcesso, resolverToken, type Leitura } from "./codigos";
import { faviconsDaPagina } from "./favicon";
import { renderizarPagina } from "./pagina-html";
import { EXTRAS_INFUSE, IMAGENS_INFUSE, PAGINA_INFUSE } from "./pagina-infuse";
import { formatarNumero } from "./token";
import type { OpcoesDestino } from "./destino";

const CABECALHOS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

const MENSAGENS = {
  404: ["Este código ainda não está disponível", "Ele pode não ter sido ativado. Procure o estabelecimento onde você encontrou este QR Code."],
  429: ["Muitas tentativas", "Aguarde um minuto e leia o QR Code novamente."],
  503: ["Serviço temporariamente indisponível", "Tente ler o QR Code novamente em instantes."],
} as const;

/** Página pública genérica. Igual para código inexistente, com destino inválido, desativado ou arquivado. */
export function respostaDeFallback(status: keyof typeof MENSAGENS): Response {
  const [titulo, texto] = MENSAGENS[status];
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${titulo}</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f6fa;color:#12151f;
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
main{max-width:420px;text-align:center}
h1{font-size:1.4rem;margin:0 0 12px;text-wrap:balance}
p{margin:0;line-height:1.5;color:#4a5263}
small{display:block;margin-top:32px;color:#8a92a3}
</style></head>
<body><main><h1>${titulo}</h1><p>${texto}</p><small>Infuse QR</small></main></body></html>`;
  return new Response(html, {
    status,
    headers: { ...CABECALHOS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'" },
  });
}

export type OpcoesPublico = OpcoesDestino & {
  /** Agenda trabalho para depois da resposta. */
  adiar?: (tarefa: () => Promise<void>) => void;
};

/**
 * GET /q/:token. Lê do banco, a cada acesso, o que o código faz agora: redireciona com
 * 302 sem cache para o destino atual ou mostra a página de links na própria URL do QR.
 * Código ainda não configurado mostra a página da Infuse com o nº de inventário, sem contar acesso.
 * A estatística roda depois e nunca interfere na resposta.
 */
export async function atenderLeitura(db: Db, token: string, op: OpcoesPublico = {}): Promise<Response> {
  let alvo: Leitura | null;
  try {
    alvo = await resolverToken(db, token, op);
  } catch {
    return respostaDeFallback(503);
  }
  if (!alvo) return respostaDeFallback(404);
  if (alvo.tipo === "disponivel") {
    return new Response(renderizarPagina(PAGINA_INFUSE, IMAGENS_INFUSE, { ...EXTRAS_INFUSE, codigo: formatarNumero(alvo.numero) }), {
      status: 200, headers: { ...CABECALHOS, "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { id } = alvo;
  const contar = () => registrarAcesso(db, id).catch(() => {});
  try {
    (op.adiar ?? ((t) => void t()))(contar);
  } catch {
    // Sem contexto para adiar: segue sem estatística.
  }
  if (alvo.tipo === "pagina") {
    const imagem = (tipo: "logo" | "fundo") =>
      alvo.imagens[tipo] ? `/q/${token}/img/${tipo}?v=${alvo.imagens[tipo]}` : undefined;
    // Sem favicon guardado (ou com o banco falhando nesta consulta) o botão fica com o ícone genérico.
    const favicons = await faviconsDaPagina(db, alvo.pagina).catch(() => ({}));
    return new Response(renderizarPagina(alvo.pagina, { logo: imagem("logo"), fundo: imagem("fundo") }, { favicons }), {
      status: 200, headers: { ...CABECALHOS, "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(null, { status: 302, headers: { ...CABECALHOS, Location: alvo.destino } });
}
