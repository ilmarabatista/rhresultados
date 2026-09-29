/**
 * Copia todos os dados do banco local (o do .env) para o banco na nuvem.
 *
 *   node --env-file=.env scripts/copiar-para-nuvem.mjs "<url do banco de destino>"
 *
 * O destino precisa já ter as tabelas (prisma migrate deploy) e estar VAZIO:
 * o script se recusa a escrever por cima de dados. As tabelas são copiadas na
 * ordem das chaves estrangeiras (pais antes dos filhos), em lotes, e no fim
 * confere se cada tabela ficou com o mesmo número de linhas.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const destinoUrl = process.argv[2];
if (!destinoUrl) {
  console.error("Informe a URL do banco de destino.");
  process.exit(1);
}
if (destinoUrl === process.env.DATABASE_URL || destinoUrl === process.env.DIRECT_URL) {
  console.error("O destino é o próprio banco local. Nada foi feito.");
  process.exit(1);
}

const origem = new PrismaClient();
const destino = new PrismaClient({ datasources: { db: { url: destinoUrl } } });

const modelos = Prisma.dmmf.datamodel.models;
const chave = (nome) => nome[0].toLowerCase() + nome.slice(1);

// Ordem das tabelas: cada uma depois das tabelas para as quais ela aponta.
const dependeDe = new Map(
  modelos.map((m) => [
    m.name,
    new Set(
      m.fields
        .filter((f) => f.kind === "object" && f.relationFromFields?.length && f.type !== m.name)
        .map((f) => f.type),
    ),
  ]),
);
const ordem = [];
const feitos = new Set();
while (ordem.length < modelos.length) {
  const prontos = modelos.filter((m) => !feitos.has(m.name) && [...dependeDe.get(m.name)].every((d) => feitos.has(d)));
  if (prontos.length === 0) throw new Error("Ciclo nas chaves estrangeiras: não sei a ordem.");
  for (const m of prontos) {
    ordem.push(m);
    feitos.add(m.name);
  }
}

// Json vazio precisa ir como "sem valor", não como null comum.
function limpar(modelo, linha) {
  const saida = { ...linha };
  for (const f of modelo.fields) {
    if (f.kind === "object") delete saida[f.name];
    else if (f.type === "Json" && saida[f.name] === null) saida[f.name] = Prisma.DbNull;
  }
  return saida;
}

let problema = false;
try {
  for (const m of ordem) {
    const n = await destino[chave(m.name)].count();
    if (n > 0) {
      console.error(`O destino já tem dados em ${m.name} (${n} linhas). Nada foi copiado.`);
      process.exit(1);
    }
  }

  for (const m of ordem) {
    const linhas = await origem[chave(m.name)].findMany();
    for (let i = 0; i < linhas.length; i += 200) {
      await destino[chave(m.name)].createMany({ data: linhas.slice(i, i + 200).map((l) => limpar(m, l)) });
    }
    if (linhas.length) console.log(`${m.name}: ${linhas.length}`);
  }

  // O número do registro de ponto continua de onde parou.
  await destino.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"PontoMarcacao"', 'nsr'), COALESCE((SELECT MAX(nsr) FROM "PontoMarcacao"), 0) + 1, false)`,
  );

  for (const m of ordem) {
    const [a, b] = await Promise.all([origem[chave(m.name)].count(), destino[chave(m.name)].count()]);
    if (a !== b) {
      problema = true;
      console.error(`DIFERENÇA em ${m.name}: local ${a}, nuvem ${b}`);
    }
  }
  console.log(problema ? "Terminou COM diferenças — veja acima." : "Tudo copiado: todas as tabelas conferem.");
} finally {
  await origem.$disconnect();
  await destino.$disconnect();
}
process.exit(problema ? 1 : 0);
