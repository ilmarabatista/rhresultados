import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import {
  gap,
  lerStatusDaMeta,
  lerTipoDeAcao,
  nivelFinal,
  progressoDoPlano,
  resumoDaAvaliacao,
  ROTULO_DA_ACAO,
  ROTULO_DA_META,
} from "@/lib/pdi";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDI para imprimir — RH Resultados" };

/** O PDI em uma folha: o diagnóstico, as metas SMART com as ações e as conversas. */
export default async function ImprimirPdiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pessoaId: string }>;
  searchParams: Promise<{ plano?: string }>;
}) {
  await requireSession();
  const { id, pessoaId } = await params;
  const sp = await searchParams;

  const pessoa = await prisma.employee.findFirst({
    where: { id: pessoaId, companyId: id },
    select: {
      name: true,
      role: true,
      company: { select: { name: true } },
      plans: {
        orderBy: { createdAt: "desc" },
        include: {
          avaliacao: { include: { notas: { orderBy: { ordem: "asc" } } } },
          metas: { orderBy: { ordem: "asc" }, include: { acoes: { orderBy: { order: "asc" } } } },
          conversas: { orderBy: { data: "asc" } },
        },
      },
    },
  });
  if (!pessoa) notFound();
  const plano = pessoa.plans.find((p) => p.id === sp.plano) ?? pessoa.plans.find((p) => p.status === "EM_ANDAMENTO") ?? pessoa.plans[0];

  const voltar = `/empresas/${id}/pdi/${pessoaId}`;
  if (!plano) {
    return (
      <main className="text-sm text-slate-500">
        Nenhum plano para imprimir. <Link href={voltar} className="text-brand-700 underline">Voltar</Link>
      </main>
    );
  }
  const notas = plano.avaliacao?.notas ?? [];
  const resumo = resumoDaAvaliacao(notas);
  const progresso = progressoDoPlano(plano.metas);

  return (
    <main className="mx-auto max-w-4xl space-y-5 bg-white p-6 text-slate-800 print:p-0">
      <div className="no-print flex items-center justify-between">
        <Link href={voltar} className="text-sm text-slate-500 hover:text-slate-900">
          ← Voltar ao PDI
        </Link>
        <PrintButton />
      </div>

      <header className="border-b-2 border-brand-900 pb-3">
        <p className="text-[11px] uppercase tracking-wider text-slate-400">
          Plano de Desenvolvimento Individual · {pessoa.company.name}
        </p>
        <h1 className="mt-1 text-xl font-semibold">{pessoa.name}</h1>
        <p className="text-sm text-slate-600">
          {[pessoa.role, plano.title].filter(Boolean).join(" · ")}
          {plano.startDate || plano.endDate
            ? ` · ${plano.startDate ? formatFullDate(plano.startDate) : "—"} a ${plano.endDate ? formatFullDate(plano.endDate) : "—"}`
            : ""}
        </p>
        {plano.objective ? <p className="mt-2 text-sm"><strong>Objetivo:</strong> {plano.objective}</p> : null}
      </header>

      {plano.avaliacao ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">
            Diagnóstico · avaliação de {formatFullDate(plano.avaliacao.data)}
          </h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border border-slate-200 px-2 py-1">Competência</th>
                <th className="border border-slate-200 px-2 py-1 text-center">Esperado</th>
                <th className="border border-slate-200 px-2 py-1 text-center">Pessoa</th>
                <th className="border border-slate-200 px-2 py-1 text-center">Avaliador</th>
                <th className="border border-slate-200 px-2 py-1 text-center">Acordado</th>
                <th className="border border-slate-200 px-2 py-1 text-center">Gap</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => {
                const g = gap(n);
                return (
                  <tr key={n.id}>
                    <td className="border border-slate-200 px-2 py-1">{n.nome}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{n.esperado}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{n.pessoa ?? "—"}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{n.avaliador ?? "—"}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center font-semibold">{nivelFinal(n) ?? "—"}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{g != null && g > 0 ? `−${g}` : g == null ? "—" : "ok"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Escala: 1 não conhece · 2 conhece, precisa de ajuda · 3 faz sozinho · 4 faz com excelência · 5 ensina os
            outros. Aderência ao cargo: {resumo.aderencia ?? "—"}%.
          </p>
          <div className="mt-3 grid gap-3 text-[12px] sm:grid-cols-2">
            {[
              ["Pontos fortes", plano.avaliacao.pontosFortes],
              ["O que quer desenvolver", plano.avaliacao.querDesenvolver],
              ["Apoio de que precisa", plano.avaliacao.apoio],
              ["Aspirações de carreira", plano.avaliacao.carreira],
            ]
              .filter(([, v]) => v)
              .map(([r, v]) => (
                <div key={r}>
                  <p className="font-semibold">{r}</p>
                  <p className="whitespace-pre-wrap text-slate-600">{v}</p>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">
          Metas SMART · progresso {progresso ?? 0}%
        </h2>
        <div className="space-y-3">
          {plano.metas.map((m, i) => (
            <div key={m.id} className="break-inside-avoid rounded border border-slate-300 p-3 text-[12px]">
              <p className="text-sm font-semibold">
                {i + 1}. {m.titulo}
                {m.competencia ? <span className="font-normal text-slate-500"> · {m.competencia}</span> : null}
              </p>
              <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <div><dt className="inline font-semibold">Como medir: </dt><dd className="inline">{m.indicador || "—"}</dd></div>
                <div><dt className="inline font-semibold">Apoio e recursos: </dt><dd className="inline">{m.recursos || "—"}</dd></div>
                <div><dt className="inline font-semibold">Por que importa: </dt><dd className="inline">{m.relevancia || "—"}</dd></div>
                <div>
                  <dt className="inline font-semibold">Prazo: </dt>
                  <dd className="inline">
                    {m.prazo ? formatFullDate(m.prazo) : "—"} · {ROTULO_DA_META[lerStatusDaMeta(m.status)]} ({m.progresso}%)
                  </dd>
                </div>
              </dl>
              {m.acoes.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {m.acoes.map((a) => (
                    <li key={a.id}>
                      {a.done ? "☑" : "☐"} {a.title} <strong>({a.quantoFeito}%)</strong>
                      <span className="text-slate-500">
                        {" "}
                        · {ROTULO_DA_ACAO[lerTipoDeAcao(a.tipo)]}
                        {a.responsavel ? ` · ${a.responsavel}` : ""}
                        {a.dueDate ? ` · até ${formatFullDate(a.dueDate)}` : ""}
                      </span>
                      {a.observacao ? <span className="block pl-4 text-slate-600">Como foi: {a.observacao}</span> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {plano.conversas.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">Acompanhamento</h2>
          <ul className="space-y-2 text-[12px]">
            {plano.conversas.map((c) => (
              <li key={c.id} className="break-inside-avoid">
                <strong>{formatFullDate(c.data)}:</strong> <span className="whitespace-pre-wrap">{c.resumo}</span>
                {c.combinados ? <p className="text-slate-600">Combinados: {c.combinados}</p> : null}
              </li>
            ))}
          </ul>
          {plano.proximaConversa ? (
            <p className="mt-2 text-[12px]">Próxima conversa: {formatFullDate(plano.proximaConversa)}</p>
          ) : null}
        </section>
      ) : null}

      {plano.balanco ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">Balanço</h2>
          <p className="whitespace-pre-wrap text-[12px]">{plano.balanco}</p>
        </section>
      ) : null}
    </main>
  );
}
