import { after } from "next/server";
import { getDb } from "@/lib/db";
import { hostsPermitidos, permiteDestinoLocal, segredoDeSessao } from "@/lib/env";
import { chaveAnonima, ipDe, LimiteEmMemoria } from "@/lib/limite";
import { atenderLeitura, respostaDeFallback } from "@/lib/publico";

export const dynamic = "force-dynamic";

// Freio contra varredura de tokens: 60 leituras por minuto por IP (por instância).
const limite = new LimiteEmMemoria(60, 60_000);

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  try {
    if (!limite.permitir(chaveAnonima("q", ipDe(req.headers), segredoDeSessao()))) return respostaDeFallback(429);
    return await atenderLeitura(getDb(), token, {
      hostsPermitidos: hostsPermitidos(),
      permitirLocal: permiteDestinoLocal(),
      adiar: (tarefa) => after(tarefa),
    });
  } catch {
    return respostaDeFallback(503);
  }
}
