import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { descreverRespostas, type ContagemDeRespostas } from "./respostas-protegidas";

/** De onde contar: o que vai ser excluído. */
export type Escopo =
  | { cargoId: string }
  | { employeeId: string }
  | { pesquisaId: string }
  | { jobOpeningId: string }
  | { companyId: string };

/** Quantas respostas por link somem se o escopo for excluído. */
export async function contarRespostas(escopo: Escopo): Promise<ContagemDeRespostas> {
  const respondido = { status: "RESPONDIDO" } as const;
  const [questionarios, autoavaliacoes, mapeamentos, clima, fichas] = await Promise.all([
    "cargoId" in escopo || "companyId" in escopo
      ? prisma.questionarioDeCargo.count({
          where: { ...respondido, ...("cargoId" in escopo ? { cargoId: escopo.cargoId } : { cargo: { companyId: escopo.companyId } }) },
        })
      : 0,
    "employeeId" in escopo || "companyId" in escopo
      ? prisma.autoavaliacao.count({
          where: { ...respondido, ...("employeeId" in escopo ? { employeeId: escopo.employeeId } : { employee: { companyId: escopo.companyId } }) },
        })
      : 0,
    "employeeId" in escopo || "companyId" in escopo
      ? prisma.mapeamentoDeRotina.count({
          where: { respondidoEm: { not: null }, ...("employeeId" in escopo ? { employeeId: escopo.employeeId } : { companyId: escopo.companyId }) },
        })
      : 0,
    "pesquisaId" in escopo || "companyId" in escopo
      ? prisma.respostaDeClima.count({
          where: "pesquisaId" in escopo ? { pesquisaId: escopo.pesquisaId } : { pesquisa: { companyId: escopo.companyId } },
        })
      : 0,
    "jobOpeningId" in escopo || "companyId" in escopo
      ? prisma.candidate.count({
          where: {
            applicationAnsweredAt: { not: null },
            ...("jobOpeningId" in escopo ? { jobOpeningId: escopo.jobOpeningId } : { companyId: escopo.companyId }),
          },
        })
      : 0,
  ]);
  return { questionarios, autoavaliacoes, mapeamentos, clima, fichas };
}

/** A descrição das respostas que somem com o escopo, ou null se não há nenhuma. */
export async function respostasQueSomem(escopo: Escopo): Promise<string | null> {
  return descreverRespostas(await contarRespostas(escopo));
}

/**
 * Roda as operações numa transação que avisa o banco que ela confirmou: sem
 * isso, o gatilho de respostas protegidas recusa apagar qualquer resposta.
 */
export async function apagarComPermissao(operacoes: Prisma.PrismaPromise<unknown>[]): Promise<void> {
  await prisma.$transaction([prisma.$executeRaw`select set_config('rh.apagar_respostas', 'sim', true)`, ...operacoes]);
}
