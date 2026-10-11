import { createHmac } from "node:crypto";
import type { Db } from "./db";

/** Chave de limite sem dado pessoal em claro: HMAC do valor (IP, usuário) com o segredo do app. */
export function chaveAnonima(prefixo: string, valor: string, segredo: string): string {
  return `${prefixo}:${createHmac("sha256", segredo).update(valor).digest("hex").slice(0, 32)}`;
}

/** Janela fixa persistida no banco: vale entre instâncias serverless. Usada no login. */
export async function consumirLimite(
  db: Db, chave: string, limite: number, janelaSeg: number, agora = new Date(),
): Promise<boolean> {
  const inicio = new Date(Math.floor(agora.getTime() / (janelaSeg * 1000)) * janelaSeg * 1000);
  const { rows } = await db.query<{ total: number }>(
    `insert into limites (chave, janela, total) values ($1, $2, 1)
     on conflict (chave, janela) do update set total = limites.total + 1
     returning total`,
    [chave, inicio.toISOString()],
  );
  return (rows[0]?.total ?? limite + 1) <= limite;
}

/**
 * Janela fixa em memória, por instância. Usada na rota pública /q para não somar
 * uma escrita no banco a cada leitura. Em serverless é "melhor esforço".
 */
export class LimiteEmMemoria {
  private contadores = new Map<string, { janela: number; total: number }>();
  constructor(private limite: number, private janelaMs: number) {}

  permitir(chave: string, agora = Date.now()): boolean {
    const janela = Math.floor(agora / this.janelaMs);
    const atual = this.contadores.get(chave);
    if (!atual || atual.janela !== janela) {
      if (this.contadores.size > 20_000) this.contadores.clear();
      this.contadores.set(chave, { janela, total: 1 });
      return true;
    }
    atual.total += 1;
    return atual.total <= this.limite;
  }
}

/** IP do cliente atrás do proxy da plataforma. Usado só para compor chaves anônimas. */
export function ipDe(cabecalhos: Headers): string {
  return cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() || cabecalhos.get("x-real-ip") || "desconhecido";
}
