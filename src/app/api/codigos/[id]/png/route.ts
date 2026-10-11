import { adminDoRequest } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { obterCodigo } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { baseUrl, ErroDeConfiguracao } from "@/lib/env";
import { nomeDoArquivo } from "@/lib/exportar";
import { inteiroPositivo } from "@/lib/formato";
import { gerarPng } from "@/lib/qr";
import { formatarNumero, urlPublica } from "@/lib/token";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await adminDoRequest(req);
  if (!admin) return new Response("Não autenticado.", { status: 401 });

  const id = inteiroPositivo((await ctx.params).id);
  const db = getDb();
  const codigo = id ? await obterCodigo(db, id) : null;
  if (!codigo) return new Response("Código não encontrado.", { status: 404 });

  const query = new URL(req.url).searchParams;
  const previa = query.get("previa") === "1";
  let png: Buffer;
  try {
    png = gerarPng(urlPublica(baseUrl(), codigo.token), {
      tamanho: previa ? 360 : 1024,
      legenda: query.get("legenda") === "1" ? formatarNumero(codigo.numero) : undefined,
    });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return new Response(e.message, { status: 500 });
    throw e;
  }
  // A prévia exibida no painel não conta como exportação.
  if (!previa) await registrar(db, { adminId: admin.id, codigoId: codigo.id, acao: "EXPORTACAO", meta: { formato: "png" } });
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${previa ? "inline" : "attachment"}; filename="${nomeDoArquivo(codigo)}"`,
    },
  });
}
