/**
 * Troca o login (e-mail) e a senha de quem entra no sistema.
 *
 *   node --env-file=.env scripts/trocar-senha.mjs [e-mail atual]
 *
 * O e-mail novo é opcional: Enter mantém o que já está. A senha é digitada na
 * hora, não aparece na tela e não fica guardada em lugar nenhum a não ser
 * embaralhada (bcrypt) no banco — do mesmo jeito que a tela de login faz.
 */

import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Pergunta normal, mostrando o que é digitado — serve para o e-mail. */
function perguntar(pergunta) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(pergunta, (resposta) => {
      rl.close();
      resolve(resposta);
    });
  });
}

/** Pergunta escondendo o que é digitado, para a senha não ficar na tela. */
function perguntarEscondido(pergunta) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const escrever = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = function (texto) {
      // Deixa a pergunta aparecer; o que ela digita, não.
      if (texto.includes(pergunta)) escrever(texto);
    };
    rl.question(pergunta, (resposta) => {
      rl._writeToOutput = escrever;
      rl.output.write("\n");
      rl.close();
      resolve(resposta);
    });
  });
}

async function main() {
  const usuarios = await prisma.user.findMany({ where: { active: true }, select: { email: true, name: true } , orderBy: { createdAt: "asc" } });
  if (usuarios.length === 0) {
    console.error("Não há usuário ativo no banco.");
    process.exit(1);
  }

  const email = (process.argv[2] ?? usuarios[0].email).toLowerCase().trim();
  const usuario = usuarios.find((u) => u.email.toLowerCase() === email);
  if (!usuario) {
    console.error(`Não achei "${email}". Usuários ativos: ${usuarios.map((u) => u.email).join(", ")}`);
    process.exit(1);
  }

  console.log(`\nTrocando o acesso de ${usuario.name} (${usuario.email}).`);

  const novoEmail = (await perguntar(`Novo login (Enter para manter ${usuario.email}): `)).trim().toLowerCase();
  if (novoEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
    console.error("\nIsso não parece um e-mail. Nada foi mudado.");
    process.exit(1);
  }
  if (novoEmail && novoEmail !== usuario.email.toLowerCase()) {
    const jaExiste = await prisma.user.findUnique({ where: { email: novoEmail }, select: { id: true } });
    if (jaExiste) {
      console.error("\nJá existe um usuário com esse e-mail. Nada foi mudado.");
      process.exit(1);
    }
  }

  console.log("\nAgora a senha. Ela não vai aparecer na tela enquanto você escreve.\n");

  const senha = await perguntarEscondido("Nova senha: ");
  if (senha.trim().length < 8) {
    console.error("\nA senha precisa ter pelo menos 8 caracteres. Nada foi mudado.");
    process.exit(1);
  }
  const repetida = await perguntarEscondido("Digite de novo: ");
  if (senha !== repetida) {
    console.error("\nAs duas não são iguais. Nada foi mudado.");
    process.exit(1);
  }

  const emailFinal = novoEmail || usuario.email;
  await prisma.user.update({
    where: { email: usuario.email },
    data: { email: emailFinal, passwordHash: await bcrypt.hash(senha, 10) },
  });
  console.log(`\nPronto. Entre em http://localhost:3000 com ${emailFinal} e a senha que você acabou de escolher.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
