import { fecharDb, getDb } from "../src/lib/db";
import { aplicarRetencao } from "../src/lib/retencao";

try {
  process.loadEnvFile?.(".env");
} catch {}

console.log("Registros removidos:", await aplicarRetencao(getDb()));
await fecharDb();
