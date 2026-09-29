import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { addDaysUTC, dayKeyToDate, formatFullDate, todayKey } from "@/lib/dates";
import { faixaHoraria } from "@/lib/agenda";
import { iniciais } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultores — RH Resultados" };

/** Quantos dias à frente contam como "carga" de cada consultor. */
const JANELA = 30;

/**
 * Quem da consultoria está com quê: os compromissos de cada consultor nos
 * próximos 30 dias, pela agenda ("Quem vai"), e as empresas que ele atende.
 */
export default async function EquipePage() {
  const session = await requireSession();
  const hoje = dayKeyToDate(todayKey());
  const ate = addDaysUTC(hoje, JANELA);

  const [usuarios, compromissos, semConsultor] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.visit.findMany({
      where: { status: "AGENDADA", date: { gte: hoje, lt: ate }, consultantId: { not: null } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        subject: true,
        consultantId: true,
        companyId: true,
        company: { select: { name: true } },
      },
    }),
    prisma.visit.count({
      where: { status: "AGENDADA", date: { gte: hoje, lt: ate }, consultantId: null },
    }),
  ]);

  const porConsultor = new Map<string, typeof compromissos>();
  for (const c of compromissos) {
    const lista = porConsultor.get(c.consultantId!) ?? [];
    lista.push(c);
    porConsultor.set(c.consultantId!, lista);
  }
  const maiorCarga = Math.max(1, ...usuarios.map((u) => porConsultor.get(u.id)?.length ?? 0));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Consultores</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Quem está com quê nos próximos {JANELA} dias, pela agenda. O consultor
          de cada compromisso é o &quot;Quem vai&quot; do agendamento.
        </p>
      </div>

      {semConsultor > 0 ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs leading-relaxed text-amber-900">
          <span className="font-medium">{semConsultor} compromisso(s) sem consultor definido</span>{" "}
          nos próximos {JANELA} dias. Escolha &quot;Quem vai&quot; ao editar o
          agendamento, na{" "}
          <Link href="/agenda" className="underline">
            Agenda
          </Link>
          .
        </p>
      ) : null}

      <ul className="space-y-3">
        {usuarios.map((u) => {
          const dele = porConsultor.get(u.id) ?? [];
          const empresas = [...new Map(dele.map((c) => [c.companyId, c.company.name])).entries()];
          const pct = Math.round((dele.length / maiorCarga) * 100);

          return (
            <li key={u.id} className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex flex-wrap items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                  {iniciais(u.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{u.name}</h2>
                    {u.id === session.userId ? (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">você</span>
                    ) : null}
                    {u.role === "ADMIN" ? (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">ADMIN</span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">{dele.length}</p>
                  <p className="text-[11px] text-slate-400">compromissos</p>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
              </div>

              {dele.length > 0 ? (
                <>
                  <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                    {dele.slice(0, 5).map((c) => (
                      <li key={c.id} className="flex gap-3 text-xs">
                        <span className="w-36 shrink-0 text-slate-400">
                          {formatFullDate(c.date)} · {faixaHoraria(c.startTime, c.endTime)}
                        </span>
                        <Link
                          href={`/empresas/${c.companyId}/agenda`}
                          className="min-w-0 truncate text-slate-700 transition hover:text-brand-700"
                        >
                          {c.company.name}
                          {c.subject ? <span className="text-slate-400"> · {c.subject}</span> : null}
                        </Link>
                      </li>
                    ))}
                    {dele.length > 5 ? (
                      <li className="text-[11px] text-slate-400">e mais {dele.length - 5}…</li>
                    ) : null}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {empresas.map(([id, nome]) => (
                      <Link
                        key={id}
                        href={`/empresas/${id}/dados`}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                      >
                        {nome}
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
                  Nenhum compromisso nos próximos {JANELA} dias.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
