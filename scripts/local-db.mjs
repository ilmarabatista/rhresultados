/**
 * Banco PostgreSQL local para desenvolvimento, sem Docker e sem instalação.
 * Sobe um Postgres embarcado na porta 5433 com os dados em ./.localdb.
 *
 *   npm run db:local
 *
 * Em produção (Vercel) isso não é usado — lá vale a DATABASE_URL do provedor.
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseDir = path.join(raiz, ".localdb");
const jaExiste = fs.existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "rh",
  password: "rh",
  port: 5433,
  persistent: true,
});

if (!jaExiste) {
  console.log("Inicializando o banco local pela primeira vez…");
  await pg.initialise();
}

await pg.start();

if (!jaExiste) {
  await pg.createDatabase("rhresultados");
}

console.log("Postgres local em postgresql://rh:rh@127.0.0.1:5433/rhresultados");
console.log("Ctrl+C para parar.");

let encerrando = false;
async function parar() {
  if (encerrando) return;
  encerrando = true;
  await pg.stop();
  process.exit(0);
}

process.on("SIGINT", parar);
process.on("SIGTERM", parar);
