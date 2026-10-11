import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { aplicarRetencao } from "@/lib/retencao";

export const dynamic = "force-dynamic";

// Chamado pelo cron da plataforma com "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET ?? "";
  const recebido = Buffer.from(req.headers.get("authorization") ?? "");
  const esperado = Buffer.from(`Bearer ${segredo}`);
  if (segredo.length < 16 || recebido.length !== esperado.length || !timingSafeEqual(recebido, esperado)) {
    return new Response("Não autorizado.", { status: 401 });
  }
  return Response.json(await aplicarRetencao(getDb()));
}
