/**
 * Pergunta os dois endereços do banco na nuvem (Neon) e grava no .env.nuvem.
 *
 *   node scripts/guardar-banco-nuvem.mjs
 *
 * Aceita o endereço colado como o Neon mostra, inclusive com "psql '...'" em volta.
 */

import { createInterface } from "node:readline/promises";
import { writeFileSync } from "node:fs";

const rl = createInterface({ input: process.stdin, output: process.stdout });

function limpar(texto) {
  return texto.trim().replace(/^psql\s+/, "").replace(/^['"]|['"]$/g, "").trim();
}

async function perguntar(rotulo, comPooler) {
  while (true) {
    const v = limpar(await rl.question(`\n${rotulo}\nCole aqui e aperte Enter: `));
    try {
      const u = new URL(v);
      if (!u.protocol.startsWith("postgres")) throw new Error();
      if (comPooler !== u.host.includes("-pooler")) {
        console.log(
          comPooler
            ? "  Este endereço não tem \"-pooler\". Ligue o Connection pooling no Neon e copie de novo."
            : "  Este endereço tem \"-pooler\". Desligue o Connection pooling no Neon e copie de novo.",
        );
        continue;
      }
      return v;
    } catch {
      console.log("  Não parece o endereço do banco (ele começa com postgresql://). Tente de novo.");
    }
  }
}

console.log("Endereços do banco na nuvem (Neon) — painel do projeto, botão Connect.");
const pooled = await perguntar("1) Com \"Connection pooling\" LIGADO (tem -pooler no endereço):", true);
const direto = await perguntar("2) Com \"Connection pooling\" DESLIGADO (sem -pooler):", false);
rl.close();

writeFileSync(
  new URL("../.env.nuvem", import.meta.url),
  `# Endereços do banco na nuvem (Neon). Não compartilhe este arquivo.\nDATABASE_URL="${pooled}"\nDIRECT_URL="${direto}"\n`,
);
console.log("\nGuardado em .env.nuvem. Pode voltar ao chat e dizer \"pronto\".");
