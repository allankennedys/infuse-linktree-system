import { alguemLogado } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { segredoDeSessao } from "@/lib/env";
import { baixarFavicon, hostDeFaviconValido, obterFavicon, salvarFavicon } from "@/lib/favicon";
import { chaveAnonima, ipDe, LimiteEmMemoria } from "@/lib/limite";

export const dynamic = "force-dynamic";

const limite = new LimiteEmMemoria(240, 60_000);
const nada = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

// Favicon de um site de destino, servido do nosso domínio. Público só para o que já está guardado;
// buscar um host novo (prévia do editor) exige estar logado, como administrador ou cliente.
export async function GET(req: Request, ctx: { params: Promise<{ host: string }> }) {
  const host = (await ctx.params).host.toLowerCase();
  try {
    if (!hostDeFaviconValido(host)) return nada(404);
    if (!limite.permitir(chaveAnonima("icone", ipDe(req.headers), segredoDeSessao()))) return nada(429);
    const db = getDb();
    let favicon = await obterFavicon(db, host);
    if (!favicon && (await alguemLogado(req))) {
      favicon = await baixarFavicon(host);
      if (favicon) await salvarFavicon(db, host, favicon);
      // Para o editor, "o site não tem favicon" é uma resposta normal, não um erro.
      else return nada(204);
    }
    if (!favicon) return nada(404);
    return new Response(new Uint8Array(favicon.dados), {
      headers: {
        "Content-Type": favicon.mime, "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return nada(503);
  }
}
