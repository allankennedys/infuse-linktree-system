import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./db";

/** Aplica, em ordem, as migrations SQL ainda não registradas. Retorna as aplicadas. */
export async function migrar(db: Db, pasta = path.join(process.cwd(), "migrations")): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (nome text primary key, aplicada_em timestamptz not null default now())",
  );
  const arquivos = (await readdir(pasta)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await db.query<{ nome: string }>("select nome from schema_migrations");
  const feitas = new Set(rows.map((r) => r.nome));
  const aplicadas: string[] = [];
  for (const arquivo of arquivos) {
    if (feitas.has(arquivo)) continue;
    const sql = await readFile(path.join(pasta, arquivo), "utf8");
    await db.tx(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (nome) values ($1)", [arquivo]);
    });
    aplicadas.push(arquivo);
  }
  return aplicadas;
}
