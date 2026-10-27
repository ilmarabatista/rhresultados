import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { lerFicha } from "./ficha";
import { lerEntrevista, lerPerguntas } from "./entrevista";
import { candidatoProvavel, lerAvaliacao } from "./fluxo-da-vaga";
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
  /** O roteiro da entrevista da vaga. */
  perguntas: string[];
  /** O cargo da lista da empresa a que a vaga está ligada: é a descrição do cargo do fluxo. */
  cargo: { id: string; nome: string; temDescricao: boolean; aprovadaEm: string | null } | null;
  cargosDaEmpresa: { id: string; nome: string }[];
  /** Testes feitos pela aba Testes para esta empresa (ou sem empresa) que ainda não são de nenhum candidato. */
  testesSoltos: { id: string; pessoa: string; teste: string; respondido: boolean; enviadoEm: string; daEmpresa: boolean; sugerido: string | null }[];
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
      perguntasDaEntrevista: true,
      company: { select: { id: true, name: true } },
      cargo: { select: { id: true, nome: true, missao: true, responsabilidades: true, aprovadaEm: true } },
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
          applicationToken: true,
          entrevistaEm: true,
          arquivos: { orderBy: { criadoEm: "asc" }, select: { id: true, nome: true, tamanho: true } },
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

  const [cargosDaEmpresa, soltos] = vaga.company
    ? await Promise.all([
        prisma.cargo.findMany({ where: { companyId: vaga.company.id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
        prisma.testeEnviado.findMany({
          where: { candidateId: null, OR: [{ companyId: vaga.company.id }, { companyId: null }] },
          orderBy: { enviadoEm: "desc" },
          take: 100,
          select: { id: true, pessoa: true, nomeDoTeste: true, status: true, enviadoEm: true, companyId: true },
        }),
      ])
    : [[], []];
  const paraLigar = vaga.candidates.map((c) => ({ id: c.id, nome: c.name, situacao: c.outcome }));

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
      ficha: c.applicationAnsweredAt ? "RESPONDIDA" : c.applicationSentAt ? "ENVIADA" : "NAO_ENVIADA",
      fichaToken: c.applicationSentAt && !c.applicationAnsweredAt ? c.applicationToken : null,
      entrevistaRegistrada: Boolean(c.entrevistaEm),
      curriculos: c.arquivos,
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
    perguntas: lerPerguntas(vaga.perguntasDaEntrevista),
    cargo: vaga.cargo
      ? {
          id: vaga.cargo.id,
          nome: vaga.cargo.nome,
          temDescricao: Boolean(vaga.cargo.missao?.trim() || vaga.cargo.responsabilidades?.trim()),
          aprovadaEm: vaga.cargo.aprovadaEm ? dataCurta(vaga.cargo.aprovadaEm) : null,
        }
      : null,
    cargosDaEmpresa,
    // Os da empresa primeiro; os sem empresa (mandados sem escolher) depois.
    testesSoltos: [...soltos]
      .sort((a, b) => Number(Boolean(b.companyId)) - Number(Boolean(a.companyId)))
      .map((t) => ({
        id: t.id,
        pessoa: t.pessoa,
        teste: t.nomeDoTeste,
        respondido: t.status === "RESPONDIDO",
        enviadoEm: dataCurta(t.enviadoEm),
        daEmpresa: Boolean(t.companyId),
        sugerido: candidatoProvavel(t.pessoa, paraLigar),
      })),
  };
}

// ------------------------------------------------------- pasta do candidato

export async function carregarPastaDoCandidato(vagaId: string, candidatoId: string) {
  const c = await prisma.candidate.findFirst({
    where: { id: candidatoId, jobOpeningId: vagaId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      outcome: true,
      applicationToken: true,
      applicationAnswers: true,
      applicationSentAt: true,
      applicationAnsweredAt: true,
      entrevista: true,
      finalNotes: true,
      avaliacaoAutomatica: true,
      stageNotes: true,
      avisadoEm: true,
      movimentos: { orderBy: { criadoEm: "asc" }, select: { id: true, etapaId: true, etapaNome: true, resultado: true, motivo: true, criadoEm: true } },
      arquivos: { orderBy: { criadoEm: "asc" }, select: { id: true, nome: true, tamanho: true, criadoEm: true } },
      etapa: { select: { nome: true } },
      jobOpening: { select: { id: true, title: true, perguntasDaEntrevista: true, etapas: { orderBy: { ordem: "asc" }, select: { id: true, nome: true } }, company: { select: { id: true, name: true } } } },
      testes: {
        orderBy: { enviadoEm: "asc" },
        select: { id: true, tipo: true, nomeDoTeste: true, status: true, resultado: true, enviadoEm: true, respondidoEm: true },
      },
    },
  });
  if (!c || !c.jobOpening) return null;
  return {
    ...c,
    ficha: c.applicationAnsweredAt ? lerFicha(c.applicationAnswers) : null,
    entrevista: lerEntrevista(c.entrevista),
    perguntas: lerPerguntas(c.jobOpening.perguntasDaEntrevista),
    curriculos: c.arquivos.map((a) => ({ id: a.id, nome: a.nome, tamanho: a.tamanho, enviadoEm: dataCurta(a.criadoEm) })),
    anotacoes: anotacoesPorEtapa(c.stageNotes, c.jobOpening.etapas, c.movimentos),
    avaliacao: lerAvaliacao(c.avaliacaoAutomatica),
  };
}

/**
 * As anotações de cada etapa, na ordem da vaga, com o nome da etapa. Uma etapa
 * que foi excluída da vaga ainda aparece pelo nome que tinha no histórico.
 */
function anotacoesPorEtapa(
  cru: unknown,
  etapas: { id: string; nome: string }[],
  movimentos: { etapaId: string | null; etapaNome: string }[],
): { etapa: string; texto: string }[] {
  const notas = cru && typeof cru === "object" && !Array.isArray(cru) ? (cru as Record<string, unknown>) : {};
  const nomes = new Map<string, string>();
  for (const m of movimentos) if (m.etapaId) nomes.set(m.etapaId, m.etapaNome);
  for (const e of etapas) nomes.set(e.id, e.nome);
  const ordem = etapas.map((e) => e.id);
  return Object.entries(notas)
    .filter((par): par is [string, string] => typeof par[1] === "string" && par[1].trim() !== "")
    .sort(([a], [b]) => (ordem.indexOf(a) === -1 ? 999 : ordem.indexOf(a)) - (ordem.indexOf(b) === -1 ? 999 : ordem.indexOf(b)))
    .map(([id, texto]) => ({ etapa: nomes.get(id) ?? (id === "SEM_ETAPA" ? "Sem etapa" : "Etapa excluída"), texto }));
}

/** As outras vagas que já têm roteiro de entrevista, para copiar. */
export async function vagasComRoteiro(excetoId: string): Promise<{ id: string; nome: string; perguntas: number }[]> {
  const vagas = await prisma.jobOpening.findMany({
    where: { id: { not: excetoId }, NOT: { perguntasDaEntrevista: { equals: Prisma.AnyNull } } },
    orderBy: { openedAt: "desc" },
    take: 50,
    select: { id: true, title: true, perguntasDaEntrevista: true, company: { select: { name: true } } },
  });
  return vagas
    .map((v) => ({
      id: v.id,
      nome: v.company ? `${v.title} · ${v.company.name}` : v.title,
      perguntas: lerPerguntas(v.perguntasDaEntrevista).length,
    }))
    .filter((v) => v.perguntas > 0);
}

/** Os cargos para a vaga escolher, com quantas perguntas de entrevista cada um leva. */
export async function listarCargosParaVaga(companyId?: string) {
  const cargos = await prisma.cargo.findMany({
    where: companyId ? { companyId } : undefined,
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, companyId: true, perguntasDaEntrevista: true },
  });
  return cargos.map((c) => ({
    id: c.id,
    nome: c.nome,
    empresaId: c.companyId,
    perguntas: lerPerguntas(c.perguntasDaEntrevista).length,
  }));
}
