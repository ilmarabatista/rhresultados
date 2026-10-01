import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  diaValido,
  inicioDaSemana,
  posicaoNaSerie,
  intervaloDaSemana,
  intervaloDoMes,
  lerMesKey,
  mesKey,
} from "@/lib/agenda";
import { dateToDayKey, todayKey } from "@/lib/dates";
import AgendaCalendar from "@/components/agenda-calendar";

export type AgendaBusca = Promise<{
  mes?: string;
  semana?: string;
  vista?: string;
}>;

/**
 * A tela da agenda.
 *
 * Fica como componente, e não como página, porque a agenda de uma empresa é a
 * mesma tela com a empresa fixa — e página do Next não aceita prop além de
 * params e searchParams.
 */
export default async function AgendaScreen({
  searchParams,
  companyId,
}: {
  searchParams: AgendaBusca;
  /** Quando vem preenchido, a agenda é a de uma empresa só. */
  companyId?: string;
}) {
  await requireSession();
  const { mes: mesParam, semana: semanaParam, vista: vistaParam } = await searchParams;

  const hoje = todayKey();
  const [anoHoje, mesHoje] = hoje.split("-").map(Number);

  // A semana é a vista principal: cada hora é uma célula para agendar.
  const vista = vistaParam === "mes" ? "mes" : "semana";
  const { ano, mes } = lerMesKey(mesParam) ?? { ano: anoHoje, mes: mesHoje };
  const segunda = inicioDaSemana(
    semanaParam && diaValido(semanaParam) ? semanaParam : hoje,
  );

  // Cada vista carrega só o seu período.
  const { de, ate } =
    vista === "semana" ? intervaloDaSemana(segunda) : intervaloDoMes(ano, mes);

  const [visitas, exames, empresas, consultores, produtos] = await Promise.all([
    prisma.visit.findMany({
      where: { date: { gte: de, lt: ate }, ...(companyId ? { companyId } : {}) },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        kind: true,
        subject: true,
        location: true,
        notes: true,
        status: true,
        companyId: true,
        company: { select: { name: true } },
        serviceId: true,
        service: { select: { name: true } },
        consultantId: true,
        consultant: { select: { name: true } },
        seriesId: true,
        frequencia: true,
        topics: { orderBy: { order: "asc" }, select: { id: true, title: true, done: true } },
      },
    }),
    // O exame ocupacional também é compromisso marcado: aparece na agenda,
    // em leitura, e leva para a ficha de quem vai fazer.
    prisma.healthExam.findMany({
      where: {
        scheduledAt: { gte: de, lt: ate },
        status: "AGENDADO",
        ...(companyId ? { companyId } : {}),
      },
      orderBy: [{ scheduledAt: "asc" }, { scheduledTime: "asc" }],
      select: {
        id: true,
        kind: true,
        scheduledAt: true,
        scheduledTime: true,
        clinic: true,
        candidateName: true,
        companyId: true,
        employeeId: true,
        company: { select: { name: true } },
        employee: { select: { name: true } },
      },
    }),
    prisma.company.findMany({
      where: companyId
        ? { id: companyId }
        : { contractStatus: { not: "ENCERRADO" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // O produto do dia vem do catálogo, o mesmo do plano e da reunião.
    prisma.service.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // A reunião que nasceu de cada compromisso: o botão vira "abrir reunião".
  const reunioesDasVisitas = visitas.length
    ? await prisma.meeting.findMany({
        // A em preparação no plano ainda não é reunião: o botão continua "Mandar para reunião".
        where: { visitId: { in: visitas.map((v) => v.id) }, status: { not: "PLANEJADA" } },
        select: { id: true, visitId: true },
      })
    : [];
  const reuniaoDa = new Map(reunioesDasVisitas.map((r) => [r.visitId!, r.id]));

  // "3 de 8" só faz sentido olhando a série inteira, e não o mês na tela.
  const seriesIds = [
    ...new Set(visitas.map((v) => v.seriesId).filter(Boolean)),
  ] as string[];

  const ocorrencias = seriesIds.length
    ? await prisma.visit.findMany({
        where: { seriesId: { in: seriesIds } },
        orderBy: { date: "asc" },
        select: { seriesId: true, date: true },
      })
    : [];

  const serie = new Map<string, string[]>();
  for (const o of ocorrencias) {
    if (!o.seriesId) continue;
    const lista = serie.get(o.seriesId);
    const dia = dateToDayKey(o.date);
    if (lista) lista.push(dia);
    else serie.set(o.seriesId, [dia]);
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <AgendaCalendar
        vista={vista}
        ano={ano}
        mes={mes}
        segunda={segunda}
        mesAtual={mesKey(anoHoje, mesHoje)}
        semanaAtual={inicioDaSemana(hoje)}
        hoje={hoje}
        visitas={visitas.map((v) => ({
          id: v.id,
          dia: dateToDayKey(v.date),
          startTime: v.startTime,
          endTime: v.endTime,
          tipo: v.kind,
          subject: v.subject,
          location: v.location,
          notes: v.notes,
          status: v.status,
          companyId: v.companyId,
          empresa: v.company.name,
          serviceId: v.serviceId,
          servico: v.service?.name ?? null,
          consultantId: v.consultantId,
          consultor: v.consultant?.name ?? null,
          seriesId: v.seriesId,
          frequencia: v.frequencia,
          naSerie: v.seriesId
            ? (posicaoNaSerie(
                dateToDayKey(v.date),
                serie.get(v.seriesId) ?? [],
              ) ?? null)
            : null,
          reuniaoId: reuniaoDa.get(v.id) ?? null,
          pauta: v.topics.map((t) => ({
            id: t.id,
            titulo: t.title,
            feito: t.done,
          })),
        }))}
        empresas={empresas.map((e) => ({ id: e.id, nome: e.name }))}
        produtos={produtos.map((p) => ({ id: p.id, nome: p.name }))}
        consultores={consultores.map((c) => ({ id: c.id, nome: c.name }))}
        empresaFixa={companyId ?? null}
        exames={exames.map((e) => ({
          id: e.id,
          dia: dateToDayKey(e.scheduledAt!),
          hora: e.scheduledTime,
          tipo: e.kind,
          pessoa: e.employee?.name ?? e.candidateName ?? "sem nome",
          clinica: e.clinic,
          empresa: e.company.name,
          companyId: e.companyId,
          employeeId: e.employeeId,
        }))}
      />
    </main>
  );
}
