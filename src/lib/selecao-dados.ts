import "server-only";
import { prisma } from "./prisma";
import { diasDesde, funilDaVaga, pendenciasDoCandidato, type EtapaTipo } from "./selecao";
import type { CandidatoNaTela, EtapaNaTela, FunilNaTela } from "@/components/selecao-quadro";
import type { VagaNaLista } from "@/components/selecao-vagas";
import type { ModeloNaTela } from "@/components/selecao-modelos";

/**
 * A leitura do processo seletivo, num lugar só: as três telas (menu Seleção,
 * aba da empresa e quadro da vaga) mostram os mesmos números, e o que conta
 * como pendência é decidido uma vez.
 */

function dataCurta(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Ficou esperando o candidato: mandou ficha ou teste e não voltou. */
function esperandoResposta(c: {
  applicationSentAt: Date | null;
  applicationAnsweredAt: Date | null;
  testes: { status: string }[];
}): boolean {
  if (c.applicationSentAt && !c.applicationAnsweredAt) return true;
  return c.testes.some((t) => t.status === "ENVIADO");
}

export async function listarVagas(companyId?: string): Promise<VagaNaLista[]> {
  const vagas = await prisma.jobOpening.findMany({
    where: companyId ? { companyId } : {},
    orderBy: [{ status: "asc" }, { openedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      openedAt: true,
      company: { select: { id: true, name: true } },
      _count: { select: { etapas: true } },
      candidates: {
        select: {
          outcome: true,
          etapaDesde: true,
          avisadoEm: true,
          applicationSentAt: true,
          applicationAnsweredAt: true,
          etapa: { select: { tipo: true, prazoDias: true } },
          testes: { select: { status: true } },
        },
      },
    },
  });

  return vagas.map((v) => {
    const pendentes = v.candidates.filter(
      (c) =>
        pendenciasDoCandidato({
          situacao: c.outcome,
          etapaTipo: (c.etapa?.tipo as EtapaTipo | undefined) ?? null,
          etapaPrazoDias: c.etapa?.prazoDias ?? null,
          etapaDesde: c.etapaDesde,
          esperandoResposta: esperandoResposta(c),
          avisado: Boolean(c.avisadoEm),
        }).length > 0,
    ).length;

    return {
      id: v.id,
      titulo: v.title,
      status: v.status,
      empresa: v.company ? { id: v.company.id, nome: v.company.name } : null,
      aberta: dataCurta(v.openedAt),
      etapas: v._count.etapas,
      emAndamento: v.candidates.filter((c) => c.outcome === "EM_ANDAMENTO").length,
      aprovados: v.candidates.filter((c) => c.outcome === "APROVADO").length,
      pendentes,
    };
  });
}

export async function listarModelos(): Promise<ModeloNaTela[]> {
  const modelos = await prisma.processoModelo.findMany({
    orderBy: { nome: "asc" },
    include: { etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, tipo: true, prazoDias: true } } },
  });
  return modelos.map((m) => ({ id: m.id, nome: m.nome, descricao: m.descricao, etapas: m.etapas }));
}

export type DadosDaVaga = {
  id: string;
  titulo: string;
  status: string;
  observacoes: string | null;
  empresa: { id: string; nome: string } | null;
  etapas: EtapaNaTela[];
  candidatos: CandidatoNaTela[];
  funil: FunilNaTela;
  /** Os testes que podem ser mandados ao candidato: o DISC e os cadastrados ativos. */
  testesDisponiveis: { id: string; nome: string }[];
};

export async function carregarVaga(vagaId: string): Promise<DadosDaVaga | null> {
  const cadastrados = await prisma.customTest.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const vaga = await prisma.jobOpening.findUnique({
    where: { id: vagaId },
    select: {
      id: true,
      title: true,
      status: true,
      notes: true,
      company: { select: { id: true, name: true } },
      etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true, tipo: true, prazoDias: true, ordem: true } },
      candidates: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          etapaId: true,
          etapaDesde: true,
          outcome: true,
          stageNotes: true,
          avisadoEm: true,
          cobradoEm: true,
          applicationSentAt: true,
          applicationAnsweredAt: true,
          etapa: { select: { tipo: true, prazoDias: true } },
          testes: {
            orderBy: { enviadoEm: "asc" },
            select: { id: true, token: true, nomeDoTeste: true, status: true },
          },
          movimentos: { orderBy: { criadoEm: "desc" }, select: { etapaId: true, resultado: true, motivo: true } },
        },
      },
    },
  });
  if (!vaga) return null;

  const candidatos: CandidatoNaTela[] = vaga.candidates.map((c) => {
    const notas = (c.stageNotes && typeof c.stageNotes === "object" && !Array.isArray(c.stageNotes)
      ? (c.stageNotes as Record<string, string>)
      : {}) as Record<string, string>;
    return {
      id: c.id,
      nome: c.name,
      telefone: c.phone,
      email: c.email,
      etapaId: c.etapaId,
      situacao: c.outcome,
      diasNaEtapa: diasDesde(c.etapaDesde),
      pendencias: pendenciasDoCandidato({
        situacao: c.outcome,
        etapaTipo: (c.etapa?.tipo as EtapaTipo | undefined) ?? null,
        etapaPrazoDias: c.etapa?.prazoDias ?? null,
        etapaDesde: c.etapaDesde,
        esperandoResposta: esperandoResposta(c),
        avisado: Boolean(c.avisadoEm),
      }),
      anotacao: notas[c.etapaId ?? "SEM_ETAPA"] ?? "",
      avisado: Boolean(c.avisadoEm),
      cobradoEm: c.cobradoEm ? dataCurta(c.cobradoEm) : null,
      ultimoMotivo: c.movimentos.find((m) => m.motivo)?.motivo ?? null,
      testes: c.testes.map((t) => ({
        id: t.id,
        token: t.token,
        nome: t.nomeDoTeste,
        respondido: t.status === "RESPONDIDO",
      })),
    };
  });

  return {
    id: vaga.id,
    titulo: vaga.title,
    status: vaga.status,
    observacoes: vaga.notes,
    empresa: vaga.company ? { id: vaga.company.id, nome: vaga.company.name } : null,
    etapas: vaga.etapas.map((e) => ({ ...e, tipo: e.tipo as EtapaTipo })),
    candidatos,
    funil: funilDaVaga(
      vaga.etapas.map((e) => ({ id: e.id, nome: e.nome })),
      vaga.candidates.map((c) => ({
        etapaId: c.etapaId,
        situacao: c.outcome,
        movimentos: c.movimentos.map((m) => ({ etapaId: m.etapaId, resultado: m.resultado })),
      })),
    ),
    testesDisponiveis: [
      { id: "DISC", nome: "Perfil comportamental (DISC)" },
      ...cadastrados.map((t) => ({ id: t.id, nome: t.name })),
    ],
  };
}
