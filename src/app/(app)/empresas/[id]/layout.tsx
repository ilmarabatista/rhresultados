import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dayKeyToDate, formatFullDate, todayKey } from "@/lib/dates";
import { faixaHoraria } from "@/lib/agenda";
import { iniciais } from "@/lib/text";
import CompanyTabs from "@/components/company-tabs";
import { Etiqueta } from "@/components/ui";

/**
 * A moldura da ficha do cliente.
 *
 * O nome no alto, e à esquerda uma coluna curta: o contato, as abas, os
 * próximos compromissos e só as pendências que pedem ação — compromisso que
 * passou sem marcar feito, combinado atrasado ou sem data, exame por fazer.
 * Número que não muda nada no dia (quantos produtos, quantas pessoas) não fica.
 */

type Pendencia = { href: string; texto: string; tom: "ruim" | "atencao" | "neutro" };

const COR_DA_PENDENCIA: Record<Pendencia["tom"], string> = {
  ruim: "text-red-700 hover:text-red-900",
  atencao: "text-amber-700 hover:text-amber-900",
  neutro: "text-slate-500 hover:text-brand-700",
};

function vezes(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const hoje = dayKeyToDate(todayKey());

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      industry: true,
      contractStatus: true,
      employeeCount: true,
      contactName: true,
      contactPhone: true,
      briefing: true,
    },
  });

  if (!company) notFound();

  const combinadosAbertos = {
    kind: "COMBINADO",
    done: false,
    meeting: { companyId: id, status: { notIn: ["ARQUIVADA", "PLANEJADA"] as string[] } },
  } as const;

  const [agenda, semMarcar, atrasados, semData, examesAbertos, encontrosPerdidos] = await Promise.all([
    prisma.visit.findMany({
      where: { companyId: id, status: "AGENDADA", date: { gte: hoje } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 3,
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        subject: true,
        service: { select: { name: true } },
      },
    }),
    prisma.visit.count({ where: { companyId: id, status: "AGENDADA", date: { lt: hoje } } }),
    prisma.meetingItem.count({ where: { ...combinadosAbertos, dueDate: { lt: hoje } } }),
    prisma.meetingItem.count({ where: { ...combinadosAbertos, dueDate: null } }),
    prisma.healthExam.count({
      where: { companyId: id, status: { in: ["A_AGENDAR", "AGENDADO"] } },
    }),
    // Encontro de plano ativo cuja data passou sem ir para a agenda.
    prisma.encontroDoPlano.count({
      where: {
        plano: { companyId: id, status: "ATIVO" },
        visitId: null,
        data: { lt: hoje },
        OR: [{ meetingId: null }, { meeting: { status: "PLANEJADA" } }],
      },
    }),
  ]);

  const pendencias: Pendencia[] = [
    ...(atrasados > 0
      ? [{ href: `/empresas/${id}/reunioes`, texto: vezes(atrasados, "combinado atrasado", "combinados atrasados"), tom: "ruim" as const }]
      : []),
    ...(semMarcar > 0
      ? [
          {
            href: `/empresas/${id}/agenda`,
            texto: `${vezes(semMarcar, "compromisso passou", "compromissos passaram")} sem marcar feito`,
            tom: "atencao" as const,
          },
        ]
      : []),
    ...(semData > 0
      ? [{ href: `/empresas/${id}/reunioes`, texto: vezes(semData, "combinado sem data", "combinados sem data"), tom: "atencao" as const }]
      : []),
    ...(encontrosPerdidos > 0
      ? [
          {
            href: `/empresas/${id}/planejamento`,
            texto: `${vezes(encontrosPerdidos, "encontro do plano passou", "encontros do plano passaram")} sem ir para a agenda`,
            tom: "atencao" as const,
          },
        ]
      : []),
    ...(examesAbertos > 0
      ? [{ href: `/empresas/${id}/equipe`, texto: vezes(examesAbertos, "exame por fazer", "exames por fazer"), tom: "atencao" as const }]
      : []),
    ...(company.briefing
      ? []
      : [{ href: `/empresas/${id}/dados`, texto: "sem briefing", tom: "neutro" as const }]),
  ];

  const status = company.contractStatus;

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-2 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="/empresas"
              className="text-xs text-slate-400 transition hover:text-brand-700"
            >
              ‹ Empresas
            </Link>
            <h1 className="text-base font-semibold tracking-tight text-slate-900">
              {company.name}
            </h1>
            <Etiqueta tom={status === "ATIVO" ? "bom" : status === "PROSPECTO" ? "azul" : "neutro"}>
              {status}
            </Etiqueta>
            {company.industry ? (
              <span className="text-xs text-slate-400">{company.industry}</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-3.5 sm:px-6">
        <div className="grid gap-3.5 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <aside className="no-print space-y-2.5 lg:sticky lg:top-4 lg:self-start">
            {/* O nome já está no alto: aqui fica só como falar com o cliente. */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-900 text-xs font-semibold text-white">
                {iniciais(company.name)}
              </span>
              <div className="min-w-0 text-[11px] leading-snug text-slate-500">
                {company.contactName ? (
                  <p className="truncate text-slate-700">{company.contactName}</p>
                ) : null}
                {company.contactPhone ? <p className="truncate">{company.contactPhone}</p> : null}
                {company.employeeCount ? <p>{company.employeeCount} funcionários</p> : null}
                {!company.contactName && !company.contactPhone && !company.employeeCount ? (
                  <Link href={`/empresas/${id}/dados`} className="text-slate-400 transition hover:text-brand-700">
                    sem contato
                  </Link>
                ) : null}
              </div>
            </div>

            <CompanyTabs companyId={company.id} />

            {/* A agenda do cliente mora aqui: abriu a ficha, já se vê o que
                vem pela frente, em qualquer aba. */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Próximos
                </p>
                <Link
                  href={`/empresas/${id}/agenda`}
                  className="text-[10px] text-brand-700 transition hover:text-brand-800"
                >
                  agenda ›
                </Link>
              </div>

              {agenda.length === 0 ? (
                <Link
                  href={`/empresas/${id}/agenda`}
                  className="mt-1.5 block text-[11px] text-slate-400 transition hover:text-brand-700"
                >
                  Nada agendado — marcar
                </Link>
              ) : (
                <ol className="mt-1.5 space-y-1.5">
                  {agenda.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/empresas/${id}/agenda`}
                        className="block border-l-2 border-brand-200 pl-2 transition hover:border-brand-500"
                      >
                        <span className="block text-[11px] font-medium leading-tight text-brand-800">
                          {formatFullDate(v.date)} · {faixaHoraria(v.startTime, v.endTime)}
                        </span>
                        <span className="block truncate text-[10px] leading-tight text-slate-400">
                          {v.subject ?? v.service?.name ?? "encontro"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Pendências
              </p>
              {pendencias.length === 0 ? (
                <p className="text-[11px] text-slate-400">Nada pendente.</p>
              ) : (
                pendencias.map((p) => (
                  <Link
                    key={p.texto}
                    href={p.href}
                    className={`block text-[11px] leading-snug transition ${COR_DA_PENDENCIA[p.tom]}`}
                  >
                    {p.texto}
                  </Link>
                ))
              )}
            </div>
          </aside>

          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </>
  );
}
