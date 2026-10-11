import { Pool, type PoolClient } from "pg";
import { ErroDeConfiguracao, poolMax } from "./env";

type Linha = Record<string, unknown>;

/** Interface mínima de banco. Implementada com `pg` em produção e PGlite nos testes. */
export interface Db {
  query<T = Linha>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  /** Executa SQL com várias instruções (migrations). */
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

function sobreCliente(c: PoolClient): Db {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await c.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async exec(sql) {
      await c.query(sql);
    },
    // Já dentro de uma transação: reaproveita.
    tx(fn) {
      return fn(this);
    },
  };
}

export function dbDoPool(pool: Pool): Db {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await pool.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        const r = await fn(sobreCliente(c));
        await c.query("commit");
        return r;
      } catch (e) {
        await c.query("rollback").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
  };
}

const global = globalThis as unknown as { __infuseQrDb?: { db: Db; pool: Pool } };

export function getDb(): Db {
  if (!global.__infuseQrDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new ErroDeConfiguracao("DATABASE_URL não está definida.");
    const pool = new Pool({ connectionString: url, max: poolMax(), idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000 });
    // Erros em conexões ociosas não podem derrubar o processo.
    pool.on("error", () => {});
    global.__infuseQrDb = { db: dbDoPool(pool), pool };
  }
  return global.__infuseQrDb.db;
}

export async function fecharDb(): Promise<void> {
  const atual = global.__infuseQrDb;
  global.__infuseQrDb = undefined;
  await atual?.pool.end();
}

/** Código SQLSTATE de violação de unicidade. */
export function ehViolacaoDeUnicidade(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
