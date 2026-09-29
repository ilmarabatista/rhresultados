import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { iniciais } from "@/lib/text";
import { dayKeyToDate, todayKey } from "@/lib/dates";

export const metadata = { title: "Selecionar empresa — RH Resultados" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PROSPECTO: "bg-brand-50 text-brand-700 ring-brand-600/20",
  ATIVO: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PAUSADO: "bg-amber-50 text-amber-700 ring-amber-600/20",
  ENCERRADO: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export default async function SelecionarEmpresaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSession();
  const { q } = await searchParams;
  const busca = q?.trim() ?? "";

  const companies = await prisma.company.findMany({
    where: busca
      ? {
          OR: [
            { name: { contains: busca, mode: "insensitive" } },
            { industry: { contains: busca, mode: "insensitive" } },
            { cnpj: { contains: busca } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      employeeCount: true,
      contractStatus: true,
      contractService: true,
      _count: { select: { planos: true, meetings: true } },
    },
  });

  // Combinados de reunião que passaram do prazo, por empresa: é o que pede ação.
  const atrasados = await prisma.meetingItem.findMany({
    where: {
      kind: "COMBINADO",
      done: false,
      dueDate: { lt: dayKeyToDate(todayKey()) },
      meeting: { status: { notIn: ["ARQUIVADA", "PLANEJADA"] } },
    },
    select: { meeting: { select: { companyId: true } } },
  });
  const pendentesPorEmpresa = new Map<string, number>();
  for (const a of atrasados) {
    const id = a.meeting.companyId;
    pendentesPorEmpresa.set(id, (pendentesPorEmpresa.get(id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Selecione a empresa
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Escolha em qual cliente você vai trabalhar agora ou cadastre uma
            nova empresa.
          </p>
        </div>
        {/* Sem nenhuma empresa, quem convida ao cadastro é o bloco central. */}
        {companies.length > 0 || busca ? (
          <Link
            href="/empresas/nova"
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            + Nova empresa
          </Link>
        ) : null}
      </div>

      <form className="mb-4 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={busca}
          placeholder="Buscar por nome, CNPJ ou ramo…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </form>

      {companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-6 py-9 text-center">
          {busca ? (
            <>
              <p className="text-sm font-medium text-slate-700">
                Nenhuma empresa encontrada para “{busca}”.
              </p>
              <Link
                href="/empresas"
                className="mt-4 inline-block text-sm text-brand-600 transition hover:text-brand-700"
              >
                Limpar busca
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">
                Nenhuma empresa cadastrada ainda.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre o primeiro cliente para começar a planejar.
              </p>
              <Link
                href="/empresas/nova"
                className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Cadastrar empresa
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {companies.map((c) => {
            const pendentes = pendentesPorEmpresa.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                {/* Direto para o planejamento: a raiz da ficha só redireciona. */}
                <Link
                  href={`/empresas/${c.id}/planejamento`}
                  className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                      {iniciais(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                        {c.name}
                      </h2>
                      <p className="truncate text-xs text-slate-500">
                        {c.industry || "Ramo não informado"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                        STATUS_STYLE[c.contractStatus] ?? STATUS_STYLE.ENCERRADO
                      }`}
                    >
                      {c.contractStatus}
                    </span>
                    {c.employeeCount ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {c.employeeCount} func.
                      </span>
                    ) : null}
                    {pendentes > 0 ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                        {pendentes} combinado{pendentes > 1 ? "s" : ""} atrasado{pendentes > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                    {c._count.planos + c._count.meetings > 0
                      ? `${c._count.planos} plano(s) · ${c._count.meetings} reunião(ões)`
                      : "Nenhum plano nem reunião ainda"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
