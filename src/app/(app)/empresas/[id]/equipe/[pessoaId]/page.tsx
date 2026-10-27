import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, formatFullDate, formatMoment, paraCampoDeData, todayKey } from "@/lib/dates";
import { progressoDoPlano } from "@/lib/pdi";
import EmployeeDetail from "@/components/employee-detail";
import EmployeeTraining from "@/components/employee-training";
import MapeamentosDaPessoa from "@/components/mapeamentos-da-pessoa";
import { lerDados, lerStatus } from "@/lib/mapeamento";
import { matrizDaEmpresa } from "@/lib/treinamentos-dados";
import {
  escreverHoras,
  lerCategoria,
  MESES_CURTOS,
  nomeDoTreinamento,
  ROTULO_DA_CATEGORIA,
} from "@/lib/treinamentos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Colaborador — RH Resultados" };

export default async function ColaboradorPage({
  params,
}: {
  params: Promise<{ id: string; pessoaId: string }>;
}) {
  await requireSession();
  const { id, pessoaId } = await params;

  const [pessoa, unidades, cargos, matriz, participacoes] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: pessoaId, companyId: id },
      include: {
        branch: { select: { name: true } },
        records: {
          orderBy: { date: "desc" },
          include: { createdBy: { select: { name: true } } },
        },
        plans: {
          orderBy: { createdAt: "desc" },
          select: {
            title: true,
            status: true,
            proximaConversa: true,
            metas: { select: { status: true, progresso: true } },
          },
        },
        avaliacoes: { orderBy: { data: "desc" }, take: 1, select: { data: true } },
        exams: { orderBy: { createdAt: "desc" } },
        integracao: { orderBy: { ordem: "asc" } },
        mapeamentos: {
          orderBy: [{ dataDaEntrevista: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            dataDaEntrevista: true,
            createdAt: true,
            entrevistador: true,
            versao: true,
            dados: true,
            status: true,
            token: true,
            enviadoEm: true,
            respondidoEm: true,
          },
        },
      },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.cargo.findMany({ where: { companyId: id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    matrizDaEmpresa(id),
    // As turmas em que a pessoa foi convocada: as realizadas com presença são o
    // histórico; as que ainda vão acontecer mostram onde a pendência já tem turma.
    prisma.meetingParticipant.findMany({
      where: { employeeId: pessoaId, meeting: { companyId: id, turma: { isNot: null } } },
      select: {
        present: true,
        meeting: {
          select: {
            id: true,
            date: true,
            status: true,
            turma: {
              select: {
                treinamentoId: true,
                mesPrevisto: true,
                instrutor: true,
                modalidade: true,
                horas: true,
                justificativa: true,
                treinamento: { select: { codigo: true, nome: true, categoria: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  if (!pessoa) notFound();

  const feitas = participacoes
    .filter((p) => p.present && p.meeting.status === "REALIZADA" && p.meeting.turma)
    .sort((a, b) => (b.meeting.date?.getTime() ?? 0) - (a.meeting.date?.getTime() ?? 0));
  const fezIds = new Set(feitas.map((p) => p.meeting.turma!.treinamentoId));
  const exigidos = pessoa.cargoId ? (matriz.get(pessoa.cargoId) ?? []) : [];
  const faltam = exigidos.filter((t) => !fezIds.has(t));
  const nomes = new Map(
    (
      await prisma.treinamento.findMany({
        where: { id: { in: faltam } },
        select: { id: true, codigo: true, nome: true, categoria: true },
      })
    ).map((t) => [t.id, t]),
  );
  const horasFeitas = feitas.reduce((soma, p) => soma + Number(p.meeting.turma!.horas ?? 0), 0);

  return (
    <main className="space-y-3.5">
      <Link
        href={`/empresas/${id}/equipe`}
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Voltar para a equipe
      </Link>

      <EmployeeDetail
        companyId={id}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.name }))}
        cargos={cargos}
        mapeamento={
          <MapeamentosDaPessoa
            companyId={id}
            employeeId={pessoa.id}
            nome={pessoa.name}
            telefone={pessoa.phone}
            mapeamentos={pessoa.mapeamentos.map((m) => {
              const d = lerDados(m.dados);
              return {
                id: m.id,
                data: formatFullDate(m.status === "RASCUNHO" ? (m.dataDaEntrevista ?? m.createdAt) : (m.enviadoEm ?? m.createdAt)),
                entrevistador: m.entrevistador,
                versao: m.versao,
                tarefas: d.tarefas.length,
                passos: d.passos.length,
                status: lerStatus(m.status),
                token: m.token,
                respondidoEm: m.respondidoEm ? formatFullDate(m.respondidoEm) : null,
              };
            })}
          />
        }
        treinamento={
          <EmployeeTraining
            companyId={id}
            employeeId={pessoa.id}
            temCargo={Boolean(pessoa.cargoId)}
            totalDeHoras={escreverHoras(horasFeitas)}
            etapas={pessoa.integracao.map((e) => ({
              id: e.id,
              texto: e.texto,
              feito: e.feito,
              feitoEm: e.feitoEm ? formatMoment(e.feitoEm) : null,
            }))}
            feitos={feitas.map((p) => {
              const t = p.meeting.turma!;
              return {
                reuniaoId: p.meeting.id,
                nome: nomeDoTreinamento(t.treinamento),
                categoria: ROTULO_DA_CATEGORIA[lerCategoria(t.treinamento.categoria)],
                dia: formatFullDate(p.meeting.date),
                horas: escreverHoras(t.horas == null ? null : Number(t.horas)),
                instrutor: t.instrutor,
                modalidade: t.modalidade,
              };
            })}
            pendentes={faltam.flatMap((tid) => {
              const t = nomes.get(tid);
              if (!t) return [];
              const turma = participacoes.find(
                (p) =>
                  p.meeting.turma?.treinamentoId === tid &&
                  !p.meeting.turma.justificativa &&
                  (p.meeting.status === "PLANEJADA" || p.meeting.status === "AGENDADA"),
              );
              const quando = turma
                ? turma.meeting.date
                  ? formatFullDate(turma.meeting.date)
                  : turma.meeting.turma?.mesPrevisto
                    ? `${MESES_CURTOS[turma.meeting.turma.mesPrevisto.getUTCMonth()].toLowerCase()}/${turma.meeting.turma.mesPrevisto.getUTCFullYear()}`
                    : "a agendar"
                : null;
              return [
                {
                  nome: nomeDoTreinamento(t),
                  categoria: ROTULO_DA_CATEGORIA[lerCategoria(t.categoria)],
                  turma: turma && quando ? { reuniaoId: turma.meeting.id, quando } : null,
                },
              ];
            })}
          />
        }
        pessoa={{
          id: pessoa.id,
          name: pessoa.name,
          document: pessoa.document,
          role: pessoa.role,
          cargoId: pessoa.cargoId,
          department: pessoa.department,
          email: pessoa.email,
          phone: pessoa.phone,
          branchId: pessoa.branchId,
          unidade: pessoa.branch?.name ?? null,
          birthDate: paraCampoDeData(pessoa.birthDate),
          hiredAt: paraCampoDeData(pessoa.hiredAt),
          terminatedAt: paraCampoDeData(pessoa.terminatedAt),
          status: pessoa.status,
          prestador: pessoa.prestador,
          notes: pessoa.notes,
          admissao: pessoa.hiredAt ? formatFullDate(pessoa.hiredAt) : null,
        }}
        registros={pessoa.records.map((r) => ({
          id: r.id,
          kind: r.kind,
          data: formatFullDate(r.date),
          fim: r.endDate ? formatFullDate(r.endDate) : null,
          dias:
            r.endDate && r.date
              ? Math.round(
                  (r.endDate.getTime() - r.date.getTime()) / 86_400_000,
                ) + 1
              : null,
          description: r.description,
          severity: r.severity,
          justified: r.justified,
          autor: r.createdBy?.name ?? null,
        }))}
        hoje={todayKey()}
        exames={pessoa.exams.map((e) => ({
          id: e.id,
          tipo: e.kind,
          status: e.status,
          prazo: e.dueDate ? dateToDayKey(e.dueDate) : null,
          agendadoEm: e.scheduledAt ? dateToDayKey(e.scheduledAt) : null,
          hora: e.scheduledTime,
          clinica: e.clinic,
          telefone: e.clinicPhone,
          realizadoEm: e.performedAt ? dateToDayKey(e.performedAt) : null,
          resultado: e.result,
          restricoes: e.restrictions,
          validoAte: e.validUntil ? dateToDayKey(e.validUntil) : null,
          observacoes: e.notes,
        }))}
        pdi={(() => {
          const ativo = pessoa.plans.find((p) => p.status === "EM_ANDAMENTO");
          if (!ativo) return null;
          return {
            titulo: ativo.title,
            progresso: progressoDoPlano(ativo.metas),
            metas: ativo.metas.length,
            atingidas: ativo.metas.filter((m) => m.status === "ATINGIDA").length,
            proxima: ativo.proximaConversa ? formatFullDate(ativo.proximaConversa) : null,
            atrasada: Boolean(ativo.proximaConversa && dateToDayKey(ativo.proximaConversa) < todayKey()),
          };
        })()}
        planosConcluidos={pessoa.plans.filter((p) => p.status !== "EM_ANDAMENTO").length}
        avaliadaEm={pessoa.avaliacoes[0] ? formatFullDate(pessoa.avaliacoes[0].data) : null}
      />
    </main>
  );
}
