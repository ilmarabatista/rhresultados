import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  addDaysUTC,
  dateToDayKey,
  dayKeyToDate,
  formatFullDate,
  FUSO,
  todayKey,
} from "@/lib/dates";
import { faixaHoraria } from "@/lib/agenda";
import { codigoDaReuniao } from "@/lib/reunioes";
import { listarVagas } from "@/lib/selecao-dados";
import { Numeros, Painel, Vazio, type Numero } from "@/components/ui";
import {
  ordenarComoTarefa,
  rotuloDoTipo,
  textoDoPrazo,
  urgencia,
} from "@/lib/exames";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início — RH Resultados" };

/** Dia e hora de um registro, no fuso do escritório — e não no do servidor. */
function quando(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

/** Até quantos dias à frente um encontro do plano já devia estar na agenda. */
const JANELA_DO_PLANO = 30;

/**
 * O painel do dia, em todas as empresas: o que está marcado, o que venceu e o
 * que ainda precisa de um gesto — combinado atrasado, encontro do plano fora
 * da agenda, candidato sem retorno, exame por fazer.
 */
export default async function InicioPage() {
  const session = await requireSession();
  const hoje = todayKey();
  const hojeData = dayKeyToDate(hoje);
  const limiteDoPlano = addDaysUTC(hojeData, JANELA_DO_PLANO);

  const [
    compromissosHoje,
    proximasVisitas,
    combinados,
    encontrosSemAgenda,
    examesAbertos,
    atividades,
    vagas,
  ] = await Promise.all([
    prisma.visit.count({ where: { date: hojeData, status: "AGENDADA" } }),
    // Agenda de hoje em diante: o que ainda vai acontecer.
    prisma.visit.findMany({
      where: { date: { gte: hojeData }, status: "AGENDADA" },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 8,
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        subject: true,
        companyId: true,
        company: { select: { name: true } },
        service: { select: { name: true } },
      },
    }),
    // Combinados em aberto que já venceram ou vencem na semana.
    prisma.meetingItem.findMany({
      where: {
        kind: "COMBINADO",
        done: false,
        dueDate: { lte: addDaysUTC(hojeData, 7) },
        meeting: { status: { notIn: ["ARQUIVADA", "PLANEJADA"] } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        text: true,
        responsible: true,
        dueDate: true,
        meeting: {
          select: { id: true, number: true, companyId: true, company: { select: { name: true } } },
        },
      },
    }),
    // Encontros de plano ativo, com data até 30 dias, que ainda não foram para a agenda.
    prisma.encontroDoPlano.findMany({
      where: {
        visitId: null,
        data: { not: null, lte: limiteDoPlano },
        plano: { status: "ATIVO" },
        OR: [{ meetingId: null }, { meeting: { status: "PLANEJADA" } }],
      },
      orderBy: [{ data: "asc" }, { ordem: "asc" }],
      select: {
        id: true,
        tema: true,
        data: true,
        hora: true,
        branch: { select: { name: true } },
        plano: {
          select: { titulo: true, companyId: true, company: { select: { name: true } } },
        },
      },
    }),
    // Exame ocupacional pendente é tarefa: aparece aqui até ser resolvido.
    prisma.healthExam.findMany({
      where: { status: { in: ["A_AGENDAR", "AGENDADO"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 10,
      select: {
        id: true,
        kind: true,
        status: true,
        dueDate: true,
        scheduledAt: true,
        candidateName: true,
        companyId: true,
        employeeId: true,
        company: { select: { name: true } },
        employee: { select: { name: true } },
      },
    }),
    prisma.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        description: true,
        createdAt: true,
        companyId: true,
        company: { select: { name: true } },
        user: { select: { name: true } },
      },
    }),
    listarVagas(),
  ]);

  const exames = ordenarComoTarefa(
    examesAbertos.map((e) => ({
      id: e.id,
      tipo: e.kind,
      status: e.status,
      prazo: e.dueDate ? dateToDayKey(e.dueDate) : null,
      agendadoEm: e.scheduledAt ? dateToDayKey(e.scheduledAt) : null,
      nome: e.employee?.name ?? e.candidateName ?? "sem nome",
      companyId: e.companyId,
      employeeId: e.employeeId,
      empresa: e.company.name,
    })),
  );

  const combinadosAtrasados = combinados.filter((c) => c.dueDate && dateToDayKey(c.dueDate) < hoje).length;
  const vagasComPendencia = vagas.filter((v) => v.status !== "ENCERRADA" && v.pendentes > 0);
  const candidatosPendentes = vagasComPendencia.reduce((s, v) => s + v.pendentes, 0);

  const numeros: Numero[] = [
    {
      rotulo: "Compromissos hoje",
      valor: compromissosHoje,
      detalhe: "em todas as empresas",
    },
    {
      rotulo: "Combinados atrasados",
      valor: combinadosAtrasados,
      tom: combinadosAtrasados > 0 ? "ruim" : "bom",
      detalhe: combinadosAtrasados > 0 ? "passaram do prazo" : "nada vencido",
    },
    {
      rotulo: "Encontros fora da agenda",
      valor: encontrosSemAgenda.length,
      tom: encontrosSemAgenda.length > 0 ? "atencao" : "neutro",
      detalhe: `do plano, nos próximos ${JANELA_DO_PLANO} dias`,
    },
    {
      rotulo: "Candidatos com pendência",
      valor: candidatosPendentes,
      tom: candidatosPendentes > 0 ? "atencao" : "neutro",
      detalhe: "cobrança, parado ou sem retorno",
    },
  ];

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Olá, {session.name.split(/\s+/)[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          O que está marcado e o que pede ação, em todas as empresas clientes.
        </p>
      </div>

      <div className="mb-5">
        <Numeros itens={numeros} />
      </div>

      <Painel
        className="mb-4"
        titulo="Próximos compromissos"
        descricao="O que está agendado de hoje em diante."
        acao={
          <Link href="/agenda" className="text-xs text-brand-700 transition hover:text-brand-800">
            abrir a agenda
          </Link>
        }
      >
        {proximasVisitas.length === 0 ? (
          <Vazio
            acao={
              <Link
                href="/agenda"
                className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
              >
                Agendar
              </Link>
            }
          >
            Nenhum compromisso agendado.
          </Vazio>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {proximasVisitas.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/empresas/${v.companyId}/agenda`}
                  className="block rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <span className="block text-[11px] text-slate-400">
                    {formatFullDate(v.date)} · {faixaHoraria(v.startTime, v.endTime)}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-medium text-slate-800">
                    {v.company.name}
                  </span>
                  <span className="block truncate text-[11px] text-slate-400">
                    {v.subject ?? v.service?.name ?? "sem assunto definido"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Painel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Combinados vencidos e da semana"
          descricao="Os combinados das atas que passaram do prazo ou vencem nos próximos 7 dias."
        >
          {combinados.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
              Nenhum combinado vencendo.
            </p>
          ) : (
            <ul className="scroll-thin max-h-[360px] divide-y divide-slate-50 overflow-y-auto pr-1">
              {combinados.map((c) => {
                const prazo = c.dueDate ? dateToDayKey(c.dueDate) : null;
                const venceu = prazo !== null && prazo < hoje;
                return (
                  <li key={c.id} className="py-2">
                    <Link
                      href={`/empresas/${c.meeting.companyId}/reunioes/${c.meeting.id}`}
                      className="block text-sm text-slate-700 transition hover:text-brand-700"
                    >
                      {c.text}
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {c.meeting.company.name} · {codigoDaReuniao(c.meeting.number)}
                        {c.responsible ? ` · ${c.responsible}` : ""}
                        {c.dueDate ? (
                          <span className={venceu ? "font-medium text-red-600" : ""}>
                            {" "}· {venceu ? "venceu" : "vence"} {formatFullDate(c.dueDate)}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>

        <Painel
          titulo="Encontros do plano fora da agenda"
          descricao={`Encontros de plano ativo, com data até ${JANELA_DO_PLANO} dias, que ainda não foram mandados para a agenda.`}
        >
          {encontrosSemAgenda.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
              Todos os encontros próximos já estão na agenda.
            </p>
          ) : (
            <ul className="scroll-thin max-h-[360px] divide-y divide-slate-50 overflow-y-auto pr-1">
              {encontrosSemAgenda.map((e) => {
                const passou = e.data !== null && dateToDayKey(e.data) < hoje;
                return (
                  <li key={e.id} className="py-2">
                    <Link
                      href={`/empresas/${e.plano.companyId}/planejamento`}
                      className="block text-sm text-slate-700 transition hover:text-brand-700"
                    >
                      {e.tema}
                      <span className="mt-0.5 block text-[11px] text-slate-400">
                        {e.plano.company.name} · plano {e.plano.titulo}
                        {e.branch ? ` · ${e.branch.name}` : ""}
                        {e.data ? (
                          <span className={passou ? "font-medium text-red-600" : ""}>
                            {" "}· {formatFullDate(e.data)}
                            {e.hora ? ` ${e.hora}` : ""}
                            {passou ? " (já passou)" : ""}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo="Seleção"
          descricao="Vagas com candidato esperando cobrança, parado além do prazo ou sem retorno."
          acao={
            <Link href="/selecao" className="text-xs text-brand-700 transition hover:text-brand-800">
              abrir a seleção
            </Link>
          }
        >
          {vagasComPendencia.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
              Nenhum candidato pendente.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {vagasComPendencia.map((v) => (
                <li key={v.id} className="flex items-baseline gap-3 py-2">
                  <Link
                    href={`/selecao/${v.id}`}
                    className="min-w-0 flex-1 text-sm text-slate-700 transition hover:text-brand-700"
                  >
                    {v.titulo}
                    <span className="text-slate-400"> · {v.empresa?.nome ?? "sem empresa"}</span>
                  </Link>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    {v.pendentes} pendente{v.pendentes > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        <Painel
          titulo="Exames ocupacionais a fazer"
          descricao="Agendar, acompanhar e registrar o resultado. O admissional precisa acontecer antes do primeiro dia de trabalho."
        >
          {exames.length === 0 ? (
            <p className="rounded-xl bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">
              Nenhum exame pendente.
            </p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {exames.map((e) => {
                const nivel = urgencia(e.prazo, hoje);
                const prazo = textoDoPrazo(e.prazo, hoje);

                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <Link
                      href={
                        e.employeeId
                          ? `/empresas/${e.companyId}/equipe/${e.employeeId}`
                          : `/empresas/${e.companyId}/equipe`
                      }
                      className="min-w-0 flex-1 text-sm text-slate-800 transition hover:text-brand-700"
                    >
                      <span className="font-medium">{rotuloDoTipo(e.tipo)}</span>
                      <span className="text-slate-400">
                        {" — "}
                        {e.nome}
                      </span>
                      <span className="text-slate-400"> · {e.empresa}</span>
                    </Link>

                    <span className="shrink-0 text-[11px] text-slate-400">
                      {e.status === "AGENDADO" ? "agendado" : "a agendar"}
                    </span>

                    {prazo ? (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          nivel === "ATRASADO"
                            ? "bg-red-50 text-red-700"
                            : nivel === "HOJE" || nivel === "PROXIMO"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-50 text-slate-500"
                        }`}
                      >
                        {prazo}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Painel>
      </div>

      <Painel titulo="Últimas movimentações" descricao="O que foi feito recentemente, em todas as empresas.">
        {atividades.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ul className="scroll-thin max-h-[420px] divide-y divide-slate-50 overflow-y-auto pr-1">
            {atividades.map((a) => (
              <li key={a.id} className="flex items-baseline gap-3 py-2">
                <span className="w-20 shrink-0 text-[11px] text-slate-400">{quando(a.createdAt)}</span>
                <Link
                  href={`/empresas/${a.companyId}/dados`}
                  className="min-w-0 flex-1 text-sm text-slate-700 transition hover:text-brand-700"
                >
                  <span className="text-slate-400">{a.company.name} · </span>
                  {a.description}
                </Link>
                <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                  {a.user?.name ?? "Sistema"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Painel>
    </main>
  );
}
