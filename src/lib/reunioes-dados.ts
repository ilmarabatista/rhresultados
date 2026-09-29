import "server-only";

import { prisma } from "./prisma";
import { nomeCurto } from "./produtos";

/**
 * O que a tela da reunião oferece para escolher: os produtos do catálogo, as
 * unidades da empresa, os setores da equipe, as pessoas que podem ser
 * convocadas e quem da consultoria pode ser responsável por um combinado.
 */
export async function opcoesDaReuniao(companyId: string) {
  const [produtos, unidades, setores, pessoas, consultores] = await Promise.all([
    // Todos os produtos do catálogo, contratados ou não, ativos ou não: a
    // reunião pode ser de qualquer um.
    prisma.service.findMany({
      orderBy: { order: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.branch.findMany({
      where: { companyId },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: { companyId, status: "ATIVO", department: { not: null } },
      distinct: ["department"],
      orderBy: { department: "asc" },
      select: { department: true },
    }),
    prisma.employee.findMany({
      where: { companyId, status: "ATIVO" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, department: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return {
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: nomeCurto(p.slug, p.name, p.name),
      nomeCompleto: p.name,
    })),
    unidades: unidades.map((u) => ({ id: u.id, nome: u.name })),
    setores: setores.map((s) => s.department).filter((s): s is string => Boolean(s)),
    pessoas: pessoas.map((p) => ({ id: p.id, nome: p.name, setor: p.department })),
    consultores: consultores.map((c) => c.name),
  };
}

export type OpcoesDaReuniao = Awaited<ReturnType<typeof opcoesDaReuniao>>;
