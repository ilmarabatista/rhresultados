/**
 * Limpa os dados operacionais preservando os usuários cadastrados.
 *
 *   node --env-file=.env scripts/reset-db.mjs
 *
 * Apaga as empresas e tudo o que pende delas (filiais, equipe, reuniões,
 * agenda, planos, seleção, PDI, treinamentos e o histórico de atividades). Os
 * acessos ao sistema continuam valendo.
 *
 * Só roda sozinho no banco local. Para um banco na nuvem é preciso passar
 * --nuvem, e nos dois casos o script pede para digitar APAGAR antes.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
const local = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

if (!local && !process.argv.includes("--nuvem")) {
  console.error("O DATABASE_URL não é o banco local. Para apagar um banco na nuvem, rode de novo com --nuvem.");
  process.exit(1);
}

const prisma = new PrismaClient();

const usuarios = await prisma.user.count();
const empresas = await prisma.company.count();
const onde = local ? "no banco LOCAL" : "no banco da NUVEM";

const terminal = createInterface({ input: process.stdin, output: process.stdout });
const resposta = await terminal.question(`Isto apaga ${empresas} empresa(s) ${onde}. Digite APAGAR para continuar: `);
terminal.close();

if (resposta.trim() !== "APAGAR") {
  console.log("Nada foi apagado.");
  await prisma.$disconnect();
  process.exit(0);
}

// Company é a raiz: as demais tabelas caem por onDelete: Cascade.
await prisma.company.deleteMany();

console.log(`Empresas removidas: ${empresas}`);
console.log(`Usuários preservados: ${usuarios}`);

await prisma.$disconnect();
