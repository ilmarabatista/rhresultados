/**
 * Carga inicial do catálogo de produtos, a partir de src/lib/servicos.ts.
 *
 *   npm run db:servicos
 *
 * Produtos que já existem são **preservados**: no dia a dia o catálogo é
 * editado na tela de Configurações, e sobrescrever aqui apagaria esse
 * trabalho. Só entram os que ainda não existem, casados pelo slug.
 */
import { PrismaClient } from "@prisma/client";
import { SERVICOS } from "../src/lib/servicos";

const prisma = new PrismaClient();

async function main() {
  let criados = 0;
  let preservados = 0;

  for (const [ordem, servico] of SERVICOS.entries()) {
    const existente = await prisma.service.findUnique({
      where: { slug: servico.slug },
      select: { id: true },
    });

    if (existente) {
      preservados += 1;
      console.log(`= ${servico.nome} (já existe, mantido como está)`);
      continue;
    }

    await prisma.service.create({
      data: { slug: servico.slug, order: ordem, name: servico.nome, description: servico.descricao },
    });
    criados += 1;
    console.log(`+ ${servico.nome}`);
  }

  console.log(`\n${criados} criado(s), ${preservados} preservado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
