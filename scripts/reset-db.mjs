/**
 * Limpa os dados operacionais preservando os usuários cadastrados.
 *
 *   node --env-file=.env scripts/reset-db.mjs
 *
 * Apaga empresas e tudo que depende delas (filiais, planejamentos, tarefas,
 * subtarefas, metas, projetos e o fluxo de atividades). Os acessos ao sistema
 * continuam valendo.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const usuarios = await prisma.user.count();
const empresas = await prisma.company.count();

// Company é a raiz: as demais tabelas caem por onDelete: Cascade.
await prisma.company.deleteMany();

console.log(`Empresas removidas: ${empresas}`);
console.log(`Usuários preservados: ${usuarios}`);

await prisma.$disconnect();
