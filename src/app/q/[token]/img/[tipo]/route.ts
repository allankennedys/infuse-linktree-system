import { resolverToken } from "@/lib/codigos";
import { getDb } from "@/lib/db";
import { hostsPermitidos, permiteDestinoLocal, segredoDeSessao } from "@/lib/env";
import { chaveAnonima, ipDe, LimiteEmMemoria } from "@/lib/limite";
import { obterImagem, TIPOS_DE_IMAGEM, type TipoDeImagem } from "@/lib/pagina";

export const dynamic = "force-dynamic";

const limite = new LimiteEmMemoria(240, 60_000);
const nada = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

// Logo e fundo da página pública. Só existem enquanto o código mostra a página de links.
export async function GET(req: Request, ctx: { params: Promise<{ token: string; tipo: string }> }) {
  const { token, tipo } = await ctx.params;
  try {
    if (!TIPOS_DE_IMAGEM.includes(tipo as TipoDeImagem)) return nada(404);
    if (!limite.permitir(chaveAnonima("img", ipDe(req.headers), segredoDeSessao()))) return nada(429);
    const db = getDb();
    const alvo = await resolverToken(db, token, { hostsPermitidos: hostsPermitidos(), permitirLocal: permiteDestinoLocal() });
    const imagem = alvo?.tipo === "pagina" ? await obterImagem(db, alvo.id, tipo as TipoDeImagem) : null;
    if (!imagem) return nada(404);
    return new Response(new Uint8Array(imagem.dados), {
      // A URL leva ?v=<versão>, então o cache de 1 dia não segura imagem trocada.
      headers: { "Content-Type": imagem.mime, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return nada(503);
  }
}
