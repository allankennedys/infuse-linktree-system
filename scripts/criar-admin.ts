// Cria ou atualiza um administrador. A senha vem de ADMIN_SENHA ou é pedida no terminal;
// nunca é aceita como argumento (ficaria no histórico do shell).
//   npm run admin:criar -- usuario "Nome"   (sem espaços; maiúsculas viram minúsculas)
import { createInterface } from "node:readline/promises";
import { fecharDb, getDb } from "../src/lib/db";
import { gerarHash, SENHA_MINIMA } from "../src/lib/senha";

try {
  process.loadEnvFile?.(".env");
} catch {}

const [usuario, nome] = process.argv.slice(2);
if (!usuario || !/^\S{3,200}$/.test(usuario)) {
  console.error('Uso: npm run admin:criar -- usuario "Nome"');
  process.exit(1);
}

let senha = process.env.ADMIN_SENHA ?? "";
if (!senha) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  senha = await rl.question(`Senha para ${usuario} (mín. ${SENHA_MINIMA} caracteres; fica visível ao digitar): `);
  rl.close();
}
if (senha.length < SENHA_MINIMA) {
  console.error(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
  process.exit(1);
}

const db = getDb();
await db.query(
  `insert into admins (usuario, nome, senha_hash) values ($1, $2, $3)
   on conflict (usuario) do update set senha_hash = excluded.senha_hash, nome = excluded.nome, ativo = true`,
  [usuario.toLowerCase(), nome?.trim() || usuario, await gerarHash(senha)],
);
// Trocar a senha derruba as sessões abertas desse admin.
await db.query("delete from sessoes where admin_id = (select id from admins where usuario = $1)", [usuario.toLowerCase()]);
console.log(`Administrador ${usuario.toLowerCase()} pronto.`);
await fecharDb();
