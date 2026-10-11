import { adminDoRequest } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { inteiroPositivo } from "@/lib/formato";
import { obterImagem, TIPOS_DE_IMAGEM, type TipoDeImagem } from "@/lib/pagina";

export const dynamic = "force-dynamic";

// Imagem para o painel e para a prévia: funciona mesmo com o código ainda não publicado.
export async function GET(req: Request, ctx: { params: Promise<{ id: string; tipo: string }> }) {
  if (!(await adminDoRequest(req))) return new Response("Não autenticado.", { status: 401 });
  const { id: idBruto, tipo } = await ctx.params;
  const id = inteiroPositivo(idBruto);
  const imagem = id && TIPOS_DE_IMAGEM.includes(tipo as TipoDeImagem) ? await obterImagem(getDb(), id, tipo as TipoDeImagem) : null;
  if (!imagem) return new Response("Imagem não encontrada.", { status: 404 });
  return new Response(new Uint8Array(imagem.dados), {
    headers: { "Content-Type": imagem.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
