import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "@/lib/db";
import { migrar } from "@/lib/migrar";
import { gerarHash } from "@/lib/senha";

export const BASE = "https://qr.exemplo.test";
export const SENHA = "senha-de-teste-123";

function embrulhar(alvo: PGlite | Transaction): Db {
  const db: Db = {
    async query<T>(sql: string, params?: unknown[]) {
      const r = await alvo.query<T>(sql, params);
      return { rows: r.rows, rowCount: r.affectedRows || r.rows.length };
    },
    async exec(sql) {
      await alvo.exec(sql);
    },
    tx(fn) {
      return alvo instanceof PGlite ? alvo.transaction((t) => fn(embrulhar(t))) : fn(db);
    },
  };
  return db;
}

/** Postgres real em memória (PGlite), com as migrations do projeto e um admin. */
export async function criarBanco() {
  const pg = new PGlite();
  const db = embrulhar(pg);
  await migrar(db);
  const { rows } = await db.query<{ id: number }>(
    "insert into admins (usuario, nome, senha_hash) values ('admin', 'Admin', $1) returning id",
    [await gerarHash(SENHA)],
  );
  return { db, admin: { id: rows[0]!.id }, fechar: () => pg.close() };
}
