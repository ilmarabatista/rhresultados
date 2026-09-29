import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  addDaysUTC,
  dateToDayKey,
  dayKeyToDate,
  formatFullDate,
  todayKey,
} from "@/lib/dates";
import { diaValido } from "@/lib/agenda";
import { codigoDaReuniao } from "@/lib/reunioes";
import { estadoDoEncontro } from "@/lib/planos";
import ReportFilters from "@/components/report-filters";
import PrintButton from "@/components/print-button";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios — RH Resultados" };

/** Primeiro dia do mês corrente, em UTC. */
function inicioDoMes() {
  const d = dayKeyToDate(todayKey());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function paraData(valor: string | undefined, padrao: Date) {
  return valor && diaValido(valor) ? dayKeyToDate(valor) : padrao;
}

const iso = dateToDayKey;

/**
 * A prestação de contas de um período, para um cliente: as reuniões
 * realizadas (por produto), o que os planos de treinamento entregaram, os
 * combinados cumpridos e os que seguem em aberto, e o andamento da seleção.
 *
 * A Evolução, dentro da empresa, é o relatório de um mês com a ata de cada
 * reunião; este é o resumo de qualquer período, pronto para imprimir.
 */
export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; de?: string; ate?: string }>;
}) {
  await requireSession();
  const { empresa, de, ate } = await searchParams;

  const [settings, empresas] = await Promise.all([
    getSettings(),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const dataDe = paraData(de, inicioDoMes());
  // O fim é exclusivo na consulta: soma um dia para incluir o dia escolhido.
  const dataAte = paraData(ate, dayKeyToDate(todayKey()));
  const ateExclusivo = addDaysUTC(dataAte, 1);
  const periodo = { gte: dataDe, lt: ateExclusivo };

  const selecionada = empresa ? (empresas.find((e) => e.id === empresa) ?? null) : null;

  const filtros = (
    <ReportFilters
      empresas={empresas}
      empresaAtual={selecionada?.id ?? ""}
      de={iso(dataDe)}
      ate={iso(dataAte)}
    />
  );

  if (!selecionada) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Relatórios</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          O que foi entregue ao cliente no período, para enviar como prestação
          de contas.
        </p>
        <div className="mt-4">{filtros}</div>
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-9 text-center text-sm text-slate-500">
          Escolha uma empresa para montar o relatório.
        </p>
      </main>
    );
  }

  const companyId = selecionada.id;

  const [reunioes, cumpridos, emAberto, planos, vagas] = await Promise.all([
    prisma.meeting.findMany({
      where: { companyId, status: "REALIZADA", date: periodo },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        title: true,
        date: true,
        service: { select: { name: true } },
        plano: { select: { titulo: true, service: { select: { name: true } } } },
        _count: { select: { participants: { where: { present: true } } } },
        items: { select: { kind: true } },
      },
    }),
    prisma.meetingItem.findMany({
      where: { kind: "COMBINADO", done: true, doneAt: periodo, meeting: { companyId } },
      orderBy: { doneAt: "asc" },
      select: { id: true, text: true, responsible: true, doneAt: true },
    }),
    prisma.meetingItem.findMany({
      where: {
        kind: "COMBINADO",
        done: false,
        meeting: { companyId, status: "REALIZADA", date: { lt: ateExclusivo } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true, responsible: true, dueDate: true },
    }),
    prisma.planoDeTreinamento.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        titulo: true,
        status: true,
        service: { select: { name: true } },
        encontros: {
          select: {
            data: true,
            visit: { select: { status: true } },
            meeting: { select: { status: true } },
          },
        },
      },
    }),
    prisma.jobOpening.findMany({
      where: {
        companyId,
        openedAt: { lt: ateExclusivo },
        OR: [{ closedAt: null }, { closedAt: { gte: dataDe } }],
      },
      orderBy: { openedAt: "asc" },
      select: {
        id: true,
        title: true,
        status: true,
        candidates: { select: { outcome: true } },
      },
    }),
  ]);

  const hoje = todayKey();

  // As reuniões por produto: o da reunião ou, sem ele, o do plano.
  const porProduto = new Map<string, typeof reunioes>();
  for (const r of reunioes) {
    const chave = r.service?.name ?? r.plano?.service?.name ?? "Sem produto definido";
    porProduto.set(chave, [...(porProduto.get(chave) ?? []), r]);
  }
  const grupos = [...porProduto.entries()].sort((a, b) => b[1].length - a[1].length);

  // Cada plano: quantos encontros cabiam no período e quantos aconteceram.
  const andamentoDosPlanos = planos
    .map((p) => {
      const noPeriodo = p.encontros.filter((e) => e.data && e.data >= dataDe && e.data < ateExclusivo);
      const realizados = noPeriodo.filter(
        (e) => estadoDoEncontro({ visita: e.visit, reuniao: e.meeting }) === "REALIZADO",
      ).length;
      const totalRealizados = p.encontros.filter(
        (e) => estadoDoEncontro({ visita: e.visit, reuniao: e.meeting }) === "REALIZADO",
      ).length;
      return {
        id: p.id,
        titulo: p.titulo,
        produto: p.service?.name ?? null,
        previstos: noPeriodo.length,
        realizados,
        total: p.encontros.length,
        totalRealizados,
      };
    })
    .filter((p) => p.previstos > 0 || p.totalRealizados > 0);

  const cards = [
    { label: "Reuniões realizadas", valor: reunioes.length },
    { label: "Combinados cumpridos", valor: cumpridos.length },
    { label: "Combinados em aberto", valor: emAberto.length },
    {
      label: "Encontros do plano no período",
      valor: `${andamentoDosPlanos.reduce((s, p) => s + p.realizados, 0)}/${andamentoDosPlanos.reduce((s, p) => s + p.previstos, 0)}`,
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Relatórios</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
              O que foi entregue ao cliente no período. Use Imprimir para gerar
              o PDF pelo próprio navegador. A ata completa de cada reunião do
              mês está na{" "}
              <Link href={`/empresas/${companyId}/evolucao`} className="text-brand-700 hover:underline">
                Evolução
              </Link>{" "}
              da empresa.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/api/relatorio/csv?empresa=${companyId}&de=${iso(dataDe)}&ate=${iso(dataAte)}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              CSV
            </a>
            <PrintButton />
          </div>
        </div>
        <div className="mb-4">{filtros}</div>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <header className="border-b border-slate-200 pb-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
            <p className="text-sm font-semibold text-slate-800">{settings.orgName}</p>
            <p className="text-[11px] text-slate-400">
              {[settings.orgDocument, settings.orgContact].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="text-xs uppercase tracking-[0.12em] text-brand-600">Relatório de atividades</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{selecionada.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            Período de {formatFullDate(dataDe)} a {formatFullDate(dataAte)}
          </p>
        </header>

        <div className="my-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label}>
              <p className="text-xl font-semibold text-slate-900">{c.valor}</p>
              <p className="text-xs leading-snug text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>

        <section className="print-break border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Reuniões realizadas</h3>

          {reunioes.length === 0 ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Nenhuma reunião realizada neste período.
            </p>
          ) : (
            <div className="mt-4 space-y-3.5">
              {grupos.map(([produto, itens]) => (
                <div key={produto} className="print-break">
                  <h4 className="mb-2 flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
                    {produto}
                    <span className="font-normal normal-case text-slate-400">{itens.length} reunião(ões)</span>
                  </h4>
                  <ul className="space-y-1">
                    {itens.map((r) => {
                      const decisoes = r.items.filter((i) => i.kind === "DECIDIDO").length;
                      const combinados = r.items.filter((i) => i.kind === "COMBINADO").length;
                      return (
                        <li key={r.id} className="flex items-baseline gap-3 border-b border-slate-50 py-1.5 text-sm">
                          <span className="w-16 shrink-0 text-xs text-slate-400">
                            {r.date ? formatFullDate(r.date).slice(0, 5) : "—"}
                          </span>
                          <span className="min-w-0 flex-1 text-slate-700">
                            {r.title}
                            <span className="text-xs text-slate-400">
                              {" "}· {codigoDaReuniao(r.number)}
                              {r.plano ? ` · plano ${r.plano.titulo}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {[
                              r._count.participants ? `${r._count.participants} presente(s)` : null,
                              decisoes ? `${decisoes} decisão(ões)` : null,
                              combinados ? `${combinados} combinado(s)` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {andamentoDosPlanos.length > 0 ? (
          <section className="print-break mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900">Planos de treinamento</h3>
            <ul className="mt-4 space-y-3">
              {andamentoDosPlanos.map((p) => {
                const pct = p.total ? Math.round((p.totalRealizados / p.total) * 100) : 0;
                return (
                  <li key={p.id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-slate-700">
                        {p.titulo}
                        {p.produto ? <span className="text-xs text-slate-400"> · {p.produto}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-slate-500">
                        no período: {p.realizados}/{p.previstos} · no plano todo: {p.totalRealizados}/{p.total} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="print-break mt-8 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Combinados cumpridos no período</h3>
          {cumpridos.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nenhum combinado cumprido neste período.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {cumpridos.map((c) => (
                <li key={c.id} className="flex items-baseline gap-3 border-b border-slate-50 py-1.5 text-sm">
                  <span className="w-16 shrink-0 text-xs text-slate-400">
                    {c.doneAt ? formatFullDate(c.doneAt).slice(0, 5) : "—"}
                  </span>
                  <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
                  {c.responsible ? <span className="shrink-0 text-xs text-slate-400">{c.responsible}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {emAberto.length > 0 ? (
          <section className="print-break mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900">Em desenvolvimento</h3>
            <p className="mt-0.5 text-xs text-slate-500">Combinados das reuniões realizadas que ainda estão em aberto.</p>
            <ul className="mt-3 space-y-1">
              {emAberto.map((c) => {
                const venceu = c.dueDate ? dateToDayKey(c.dueDate) < hoje : false;
                return (
                  <li key={c.id} className="flex items-baseline gap-3 border-b border-slate-50 py-1.5 text-sm">
                    <span className={`w-16 shrink-0 text-xs ${venceu ? "font-medium text-red-600" : "text-slate-400"}`}>
                      {c.dueDate ? formatFullDate(c.dueDate).slice(0, 5) : "sem data"}
                    </span>
                    <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
                    {c.responsible ? <span className="shrink-0 text-xs text-slate-400">{c.responsible}</span> : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {vagas.length > 0 ? (
          <section className="print-break mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-900">Processos seletivos</h3>
            <ul className="mt-3 space-y-1">
              {vagas.map((v) => {
                const conta = (o: string) => v.candidates.filter((c) => c.outcome === o).length;
                return (
                  <li key={v.id} className="flex items-baseline gap-3 border-b border-slate-50 py-1.5 text-sm">
                    <span className="min-w-0 flex-1 text-slate-700">
                      {v.title}
                      <span className="text-xs text-slate-400"> · {v.status.toLowerCase()}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {v.candidates.length} candidato(s) · {conta("EM_ANDAMENTO")} em andamento · {conta("APROVADO")} aprovado(s)
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-400">
          {settings.reportFooter ? <p className="mb-1 text-slate-500">{settings.reportFooter}</p> : null}
          Emitido em {formatFullDate(dayKeyToDate(todayKey()))} por {settings.orgName}.
        </footer>
      </article>
    </main>
  );
}
