import { acessoAoCodigo } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { faviconsDaPagina } from "@/lib/favicon";
import { inteiroPositivo } from "@/lib/formato";
import { obterPagina, versoesDasImagens } from "@/lib/pagina";
import { renderizarPagina } from "@/lib/pagina-html";

export const dynamic = "force-dynamic";

// Prévia da página de links salva, igual à pública, mesmo que o código esteja em outro modo ou desativado.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = inteiroPositivo((await ctx.params).id);
  if (!id || !(await acessoAoCodigo(req, id))) return new Response("Não autenticado.", { status: 401 });
  const db = getDb();
  const pagina = id ? await obterPagina(db, id) : null;
  if (!id || !pagina) return new Response("Este código ainda não tem página de links salva.", { status: 404 });
  const versoes = await versoesDasImagens(db, id);
  const imagem = (tipo: "logo" | "fundo") => (versoes[tipo] ? `/api/codigos/${id}/imagem/${tipo}?v=${versoes[tipo]}` : undefined);
  const favicons = await faviconsDaPagina(db, pagina);
  return new Response(renderizarPagina(pagina, { logo: imagem("logo"), fundo: imagem("fundo") }, { favicons }), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
