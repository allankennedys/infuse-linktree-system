import { adminDoRequest } from "@/lib/auth";
import { registrar } from "@/lib/auditoria";
import { getDb } from "@/lib/db";
import { baseUrl, ErroDeConfiguracao } from "@/lib/env";
import { gerarCsv, gerarPdf, gerarZip, LAYOUTS, type Layout } from "@/lib/exportar";
import { inteiroPositivo } from "@/lib/formato";
import { codigosDoLote, obterLote } from "@/lib/lotes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIPOS = { zip: "application/zip", pdf: "application/pdf", csv: "text/csv; charset=utf-8" } as const;

export async function GET(req: Request, ctx: { params: Promise<{ id: string; formato: string }> }) {
  const admin = await adminDoRequest(req);
  if (!admin) return new Response("Não autenticado.", { status: 401 });

  const { id: idBruto, formato } = await ctx.params;
  if (!(formato in TIPOS)) return new Response("Formato desconhecido.", { status: 404 });
  const tipo = formato as keyof typeof TIPOS;

  const db = getDb();
  const id = inteiroPositivo(idBruto);
  const lote = id ? await obterLote(db, id) : null;
  if (!lote) return new Response("Lote não encontrado.", { status: 404 });
  if (lote.status !== "PRONTO") return new Response("Este lote não está pronto para exportação.", { status: 409 });

  const query = new URL(req.url).searchParams;
  const comLegenda = query.get("legenda") === "1";
  const layoutPedido = query.get("layout") ?? "grade";
  const layout: Layout = layoutPedido in LAYOUTS ? (layoutPedido as Layout) : "grade";
  const itens = await codigosDoLote(db, lote.id);

  let corpo: Uint8Array | string;
  try {
    const base = baseUrl();
    if (tipo === "zip") corpo = gerarZip(itens, base, comLegenda);
    else if (tipo === "csv") corpo = gerarCsv(itens, base, lote.nome);
    else corpo = await gerarPdf(itens, base, { layout, comLegenda, comGuias: query.get("guias") === "1", lote: lote.nome });
  } catch (e) {
    if (e instanceof ErroDeConfiguracao) return new Response(e.message, { status: 500 });
    throw e;
  }
  await registrar(db, {
    adminId: admin.id, loteId: lote.id, acao: "EXPORTACAO",
    meta: { formato: tipo, quantidade: itens.length, ...(tipo === "pdf" ? { layout } : {}) },
  });
  const arquivo = `infuse-qr_lote-${lote.id}.${tipo}`;
  const inline = tipo === "pdf" && query.get("abrir") === "1";
  return new Response(typeof corpo === "string" ? corpo : new Uint8Array(corpo), {
    headers: {
      "Content-Type": TIPOS[tipo],
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${arquivo}"`,
    },
  });
}
