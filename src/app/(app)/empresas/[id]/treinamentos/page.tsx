import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, todayKey } from "@/lib/dates";
import {
  cumprimento,
  escreverHoras,
  lerCategoria,
  nomeDoTreinamento,
  situacaoDaTurma,
  totaisDoAno,
  type TurmaDoAno,
} from "@/lib/treinamentos";
import { feitosDaEmpresa, itensDeIntegracao, pendenciasDaEmpresa } from "@/lib/treinamentos-dados";
import TreinamentosTela from "@/components/treinamentos-tela";

export const dynamic = "force-dynamic";
export const metadata = { title: "Treinamentos — RH Resultados" };

const ABAS = ["programacao", "catalogo", "pendencias", "integracao"] as const;
type Aba = (typeof ABAS)[number];

/**
 * Treinamento e desenvolvimento da empresa.
 *
 * Programação é o planejamento anual (o antigo PAT), montado das turmas;
 * Catálogo e matriz diz o que existe e que cargo precisa de quê; Pendências
 * cruza a matriz com quem esteve presente nas turmas realizadas; Integração é
 * o checklist que cada pessoa nova da equipe recebe.
 */
export default async function TreinamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; ano?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const aba: Aba = (ABAS as readonly string[]).includes(sp.aba ?? "") ? (sp.aba as Aba) : "programacao";
  const anoAtual = Number(todayKey().slice(0, 4));
  const ano = /^\d{4}$/.test(sp.ano ?? "") ? Number(sp.ano) : anoAtual;
  const inicio = new Date(Date.UTC(ano, 0, 1));
  const fim = new Date(Date.UTC(ano + 1, 0, 1));

  const [treinamentos, cargos, turmas, pend, feitos, modelo, outrasEmpresas, semIntegracao] = await Promise.all([
    prisma.treinamento.findMany({
      where: { companyId: id },
      orderBy: [{ ativo: "desc" }, { codigo: "asc" }, { nome: "asc" }],
      include: { cargos: { select: { cargoId: true } }, _count: { select: { turmas: true } } },
    }),
    prisma.cargo.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, _count: { select: { colaboradores: { where: { status: "ATIVO" } } } } },
    }),
    prisma.turmaDeTreinamento.findMany({
      where: {
        companyId: id,
        OR: [
          { meeting: { date: { gte: inicio, lt: fim } } },
          { meeting: { date: null }, mesPrevisto: { gte: inicio, lt: fim } },
        ],
      },
      include: {
        treinamento: { select: { codigo: true, nome: true, categoria: true } },
        meeting: {
          select: {
            id: true,
            date: true,
            startTime: true,
            status: true,
            location: true,
            participants: { select: { present: true } },
          },
        },
      },
    }),
    pendenciasDaEmpresa(id),
    feitosDaEmpresa(id),
    itensDeIntegracao(id),
    prisma.company.findMany({
      where: { id: { not: id }, treinamentos: { some: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { treinamentos: true } } },
    }),
    prisma.employee.findMany({
      where: { companyId: id, status: "ATIVO", integracao: { some: { feito: false } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, integracao: { select: { feito: true } } },
    }),
  ]);

  const linhas = turmas
    .map((t) => {
      const quando = t.meeting.date ?? t.mesPrevisto;
      const situacao = situacaoDaTurma({ statusDaReuniao: t.meeting.status, justificativa: t.justificativa });
      return {
        reuniaoId: t.meeting.id,
        treinamento: nomeDoTreinamento(t.treinamento),
        categoria: lerCategoria(t.treinamento.categoria),
        mes: quando ? quando.getUTCMonth() + 1 : null,
        dia: t.meeting.date ? dateToDayKey(t.meeting.date) : null,
        hora: t.meeting.startTime,
        instrutor: t.instrutor,
        modalidade: t.modalidade,
        local: t.meeting.location,
        horas: t.horas == null ? null : Number(t.horas),
        investimento: t.investimento == null ? null : Number(t.investimento),
        convocados: t.meeting.participants.length,
        presentes: t.meeting.participants.filter((p) => p.present).length,
        situacao,
        justificativa: t.justificativa,
        ordem: quando?.getTime() ?? 0,
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  const doAno: TurmaDoAno[] = linhas.map((l) => ({
    mes: l.mes,
    situacao: l.situacao,
    horas: l.horas,
    investimento: l.investimento,
    convocados: l.convocados,
    presentes: l.presentes,
  }));
  const totais = totaisDoAno(doAno);

  // Por treinamento: quantos o cargo exige (equipe ativa), quantos já fizeram e quem falta.
  const ativosPorId = new Map(pend.pessoas.map((p) => [p.id, p]));
  const fizeram = new Map<string, Set<string>>();
  for (const f of feitos) {
    if (!ativosPorId.has(f.employeeId)) continue;
    const s = fizeram.get(f.treinamentoId) ?? new Set<string>();
    s.add(f.employeeId);
    fizeram.set(f.treinamentoId, s);
  }

  return (
    <TreinamentosTela
      companyId={id}
      aba={aba}
      ano={ano}
      // No ano corrente sugere o mês de hoje; em outro ano, janeiro.
      mesPadrao={ano === anoAtual ? todayKey().slice(0, 7) : `${ano}-01`}
      cargos={cargos.map((c) => ({ id: c.id, nome: c.nome, pessoas: c._count.colaboradores }))}
      treinamentos={treinamentos.map((t) => {
        const exigidoPor = new Set(t.cargos.map((c) => c.cargoId));
        const precisam = pend.pessoas.filter((p) => p.cargoId && exigidoPor.has(p.cargoId));
        const faltam = precisam.filter((p) => pend.porPessoa.get(p.id)?.includes(t.id));
        return {
          id: t.id,
          codigo: t.codigo,
          nome: t.nome,
          categoria: lerCategoria(t.categoria),
          cargaHoraria: t.cargaHoraria == null ? "" : escreverHoras(Number(t.cargaHoraria)),
          descricao: t.descricao ?? "",
          ativo: t.ativo,
          turmas: t._count.turmas,
          cargoIds: [...exigidoPor],
          precisam: t.ativo ? precisam.length : 0,
          fizeram: t.ativo ? precisam.length - faltam.length : 0,
          faltam: t.ativo ? faltam.map((p) => p.name) : [],
          fizeramAlgumaVez: fizeram.get(t.id)?.size ?? 0,
        };
      })}
      turmas={linhas}
      totais={{ ...totais, cumprimento: cumprimento(doAno) }}
      pessoasComPendencia={pend.pessoas
        .map((p) => ({ id: p.id, nome: p.name, pendentes: pend.porPessoa.get(p.id)?.length ?? 0 }))
        .filter((p) => p.pendentes > 0)}
      semCargo={pend.pessoas.filter((p) => !p.cargoId).length}
      modeloDeIntegracao={modelo}
      integracaoAberta={semIntegracao.map((p) => ({
        id: p.id,
        nome: p.name,
        feitos: p.integracao.filter((e) => e.feito).length,
        total: p.integracao.length,
      }))}
      outrasEmpresas={outrasEmpresas.map((e) => ({ id: e.id, nome: e.name, treinamentos: e._count.treinamentos }))}
    />
  );
}
