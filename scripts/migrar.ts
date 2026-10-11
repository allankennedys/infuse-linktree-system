import { fecharDb, getDb } from "../src/lib/db";
import { migrar } from "../src/lib/migrar";

try {
  process.loadEnvFile?.(".env");
} catch {}

const aplicadas = await migrar(getDb());
console.log(aplicadas.length ? `Migrations aplicadas: ${aplicadas.join(", ")}` : "Banco já está atualizado.");
await fecharDb();
