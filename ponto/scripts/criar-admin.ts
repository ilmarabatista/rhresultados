/**
 * Cria (ou atualiza a senha de) um administrador do ponto, com os dados de
 * ADMIN_EMAIL, ADMIN_PASSWORD e ADMIN_NAME.
 *
 *   node --env-file=.env node_modules/.bin/tsx scripts/criar-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email || !senha || senha.length < 8) {
    throw new Error("Informe ADMIN_EMAIL e ADMIN_PASSWORD (pelo menos 8 caracteres).");
  }
  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.admin.upsert({
    where: { email },
    create: { email, nome, senhaHash },
    update: { nome, senhaHash, ativo: true, sessionVersion: { increment: 1 } },
  });
  console.log(`Administrador ${email} pronto.`);
}

main().finally(() => prisma.$disconnect());
