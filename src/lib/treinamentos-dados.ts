import "server-only";

import { prisma } from "./prisma";
import {
  INTEGRACAO_PADRAO,
  limparNomeDoCargo,
  matrizPorCargo,
  mesmoCargo,
  pendencias,
  type Feito,
} from "./treinamentos";

/**
 * As leituras do banco que o módulo de treinamento divide entre a aba
 * Treinamentos, a página da turma e a ficha do colaborador.
 */

/** Quem fez o quê na empresa: presença em turma realizada. */
export async function feitosDaEmpresa(companyId: string): Promise<Feito[]> {
  const presencas = await prisma.meetingParticipant.findMany({
    where: {
      present: true,
      employeeId: { not: null },
      meeting: { companyId, status: "REALIZADA", turma: { isNot: null } },
    },
    select: { employeeId: true, meeting: { select: { turma: { select: { treinamentoId: true } } } } },
  });
  return presencas.flatMap((p) =>
    p.employeeId && p.meeting.turma ? [{ employeeId: p.employeeId, treinamentoId: p.meeting.turma.treinamentoId }] : [],
  );
}

/** A matriz da empresa, como "cargo → treinamentos (em uso) que ele pede". */
export async function matrizDaEmpresa(companyId: string) {
  const [marcas, ativos] = await Promise.all([
    prisma.treinamentoDoCargo.findMany({
      where: { treinamento: { companyId } },
      select: { treinamentoId: true, cargoId: true },
    }),
    prisma.treinamento.findMany({ where: { companyId, ativo: true }, select: { id: true } }),
  ]);
  return matrizPorCargo(marcas, new Set(ativos.map((t) => t.id)));
}

/** As pendências da equipe ativa: pessoa → treinamentos que ainda deve. */
export async function pendenciasDaEmpresa(companyId: string) {
  const [pessoas, matriz, feitos] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId, status: "ATIVO" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, cargoId: true },
    }),
    matrizDaEmpresa(companyId),
    feitosDaEmpresa(companyId),
  ]);
  return {
    pessoas,
    porPessoa: pendencias(
      pessoas.map((p) => ({ id: p.id, nome: p.name, cargoId: p.cargoId })),
      matriz,
      feitos,
    ),
  };
}

/** Quem da equipe ativa precisa deste treinamento e ainda não fez. */
export async function quemPrecisa(companyId: string, treinamentoId: string) {
  const { pessoas, porPessoa } = await pendenciasDaEmpresa(companyId);
  return pessoas.filter((p) => porPessoa.get(p.id)?.includes(treinamentoId));
}

/** O checklist de integração da empresa, ou o padrão enquanto ela não tem o seu. */
export async function itensDeIntegracao(companyId: string): Promise<string[]> {
  const itens = await prisma.itemDoModeloDeIntegracao.findMany({
    where: { companyId },
    orderBy: { ordem: "asc" },
    select: { texto: true },
  });
  return itens.length > 0 ? itens.map((i) => i.texto) : INTEGRACAO_PADRAO;
}

/** Dá à pessoa o checklist de integração, se ela ainda não tem. */
export async function gerarIntegracaoDe(employeeId: string, companyId: string) {
  const ja = await prisma.etapaDeIntegracao.count({ where: { employeeId } });
  if (ja > 0) return;
  const itens = await itensDeIntegracao(companyId);
  await prisma.etapaDeIntegracao.createMany({
    data: itens.map((texto, ordem) => ({ employeeId, texto, ordem })),
  });
}

/**
 * O cargo escolhido no cadastro: um da lista, ou um nome novo, que entra na
 * lista (ou acha o que já existe com esse nome, sem acento e sem caixa).
 */
export async function cargoDoCadastro(
  companyId: string,
  cargoId: string | null,
  novoCargo: string | null,
): Promise<{ id: string; nome: string } | null> {
  if (novoCargo && limparNomeDoCargo(novoCargo)) {
    const nome = limparNomeDoCargo(novoCargo).slice(0, 120);
    const existentes = await prisma.cargo.findMany({ where: { companyId }, select: { id: true, nome: true } });
    const igual = existentes.find((c) => mesmoCargo(c.nome, nome));
    if (igual) return igual;
    return prisma.cargo.create({ data: { companyId, nome }, select: { id: true, nome: true } });
  }
  if (!cargoId) return null;
  return prisma.cargo.findFirst({ where: { id: cargoId, companyId }, select: { id: true, nome: true } });
}
