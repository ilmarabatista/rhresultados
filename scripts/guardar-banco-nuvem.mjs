/**
 * Pergunta os dois endereços do banco na nuvem (Supabase) e grava no .env.nuvem.
 * A senha nunca passa pelo chat: você cola aqui, neste terminal.
 *
 *   node scripts/guardar-banco-nuvem.mjs
 *
 * No Supabase: botão "Connect" do projeto, aba "ORM" ou "Connection string".
 *  1) Transaction pooler (porta 6543)  → DATABASE_URL  (o sistema usa no dia a dia)
 *  2) Session pooler     (porta 5432)  → DIRECT_URL    (migrações e cópia dos dados)
 * Aceita o endereço colado como o Supabase mostra, com [YOUR-PASSWORD] já trocado
 * pela senha do banco, e mesmo com "psql '...'" em volta.
 */

import { createInterface } from "node:readline/promises";
import { writeFileSync } from "node:fs";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function limpar(texto) {
  return texto.trim().replace(/^psql\s+/, "").replace(/^['"]|['"]$/g, "").trim();
}

async function perguntar(rotulo, porta) {
  while (true) {
    const v = limpar(await rl.question(`\n${rotulo}\nCole aqui e aperte Enter: `));
    try {
      const u = new URL(v);
      if (!u.protocol.startsWith("postgres")) throw new Error();
      if (v.includes("[YOUR-PASSWORD]")) {
        console.log("  Troque [YOUR-PASSWORD] pela senha do banco e cole de novo.");
        continue;
      }
      if (u.port && u.port !== porta) {
        console.log(`  Esse endereço usa a porta ${u.port}, mas aqui precisa ser a ${porta}. Confira qual você copiou.`);
        continue;
      }
      return v;
    } catch {
      console.log("  Não parece o endereço do banco (ele começa com postgresql://). Tente de novo.");
    }
  }
}

console.log("Endereços do banco na nuvem (Supabase) — projeto rh-resultados, botão Connect.");
const pooled = await perguntar('1) Transaction pooler (porta 6543):', "6543");
const direto = await perguntar('2) Session pooler (porta 5432):', "5432");
rl.close();

const comPgbouncer = pooled.includes("pgbouncer=true") ? pooled : pooled + (pooled.includes("?") ? "&" : "?") + "pgbouncer=true";

writeFileSync(
  new URL("../.env.nuvem", import.meta.url),
  `# Endereços do banco na nuvem (Supabase). Não compartilhe este arquivo.\nDATABASE_URL="${comPgbouncer}"\nDIRECT_URL="${direto}"\n`,
);
console.log("\nGuardado em .env.nuvem. Pode voltar ao chat e dizer \"pronto\".");
