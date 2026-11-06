import { prisma } from "@/lib/prisma";
import { lerLinkDoPdi } from "@/lib/pdi-link";
import { dateToDayKey, dayKeyToDate, formatFullDate, todayKey } from "@/lib/dates";
import { lerStatusDaMeta, progressoDoPlano, ROTULO_DA_META } from "@/lib/pdi";
import { calendarioDoPdi } from "@/lib/autoavaliacao";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Meu PDI",
  robots: { index: false, follow: false },
};

/**
 * Rota pública: o PDI que o RH mandou ao colaborador depois da conversa 1 a 1.
 * Só leitura. Mostra o que foi combinado (objetivo, metas, ações, combinados
 * das conversas e os próximos encontros); as notas da avaliação ficam só no RH.
 */
export default async function MeuPdiPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const planoId = await lerLinkDoPdi(token);
  const plano = planoId
    ? await prisma.developmentPlan.findUnique({
        where: { id: planoId },
        select: {
          title: true,
          objective: true,
          startDate: true,
          endDate: true,
          status: true,
          proximaConversa: true,
          employee: { select: { name: true, role: true, company: { select: { name: true } } } },
          metas: {
            where: { status: { not: "CANCELADA" } },
            orderBy: { ordem: "asc" },
            select: {
              id: true,
              titulo: true,
              competencia: true,
              indicador: true,
              recursos: true,
              relevancia: true,
              prazo: true,
              status: true,
              progresso: true,
              acoes: {
                orderBy: { order: "asc" },
                select: { id: true, title: true, done: true, responsavel: true, dueDate: true },
              },
            },
          },
          conversas: { orderBy: { data: "asc" }, select: { id: true, data: true, combinados: true } },
        },
      })
    : null;

  if (!plano) {
    return (
      <AvisoAoCandidato
        titulo="Link indisponível"
        texto="Este link do PDI não é válido ou já venceu. Peça um novo ao RH."
      />
    );
  }

  const hoje = todayKey();
  const progresso = progressoDoPlano(plano.metas) ?? 0;
  const combinados = plano.conversas.filter((c) => c.combinados?.trim());
  const encontros = plano.startDate
    ? calendarioDoPdi(dateToDayKey(plano.startDate)).conversas.filter((d) => d >= hoje)
    : [];
  const periodo =
    plano.startDate || plano.endDate
      ? `${plano.startDate ? formatFullDate(plano.startDate) : "—"} a ${plano.endDate ? formatFullDate(plano.endDate) : "—"}`
      : null;

  const secao = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid";
  const tituloDaSecao = "mb-2 text-sm font-semibold text-slate-900";

  return (
    <PaginaDoCandidato
      empresa={plano.employee.company.name}
      titulo={`Meu PDI · ${plano.employee.name}`}
      subtitulo={[plano.employee.role, periodo].filter(Boolean).join(" · ") || null}
    >
      <div className="space-y-3">
        <section className={secao}>
          <p className="text-sm leading-relaxed text-slate-600">
            Este é o seu Plano de Desenvolvimento Individual, com o que combinamos na nossa conversa. Guarde este
            link: ele mostra as suas metas, o que você vai fazer em cada uma e as datas dos próximos encontros.
          </p>
          {plano.objective ? (
            <p className="mt-2 text-sm text-slate-800">
              <strong>Objetivo:</strong> {plano.objective}
            </p>
          ) : null}
          {plano.metas.length > 0 ? (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Andamento do plano</span>
                <span>{progresso}%</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          ) : null}
        </section>

        {plano.metas.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-semibold text-slate-900">Minhas metas</h2>
            {plano.metas.map((m, i) => (
              <div key={m.id} className={secao}>
                <p className="text-sm font-semibold text-slate-900">
                  {i + 1}. {m.titulo}
                </p>
                {m.competencia ? <p className="text-xs text-slate-500">{m.competencia}</p> : null}
                <dl className="mt-2 space-y-1 text-sm text-slate-700">
                  {m.relevancia ? (
                    <div>
                      <dt className="inline font-medium">Por que importa: </dt>
                      <dd className="inline">{m.relevancia}</dd>
                    </div>
                  ) : null}
                  {m.indicador ? (
                    <div>
                      <dt className="inline font-medium">Como vamos saber que deu certo: </dt>
                      <dd className="inline">{m.indicador}</dd>
                    </div>
                  ) : null}
                  {m.recursos ? (
                    <div>
                      <dt className="inline font-medium">Apoio que você vai ter: </dt>
                      <dd className="inline">{m.recursos}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="inline font-medium">Prazo: </dt>
                    <dd className="inline">
                      {m.prazo ? formatFullDate(m.prazo) : "—"} · {ROTULO_DA_META[lerStatusDaMeta(m.status)]}
                    </dd>
                  </div>
                </dl>
                {m.acoes.length > 0 ? (
                  <>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">O que vou fazer</p>
                    <ul className="mt-1 space-y-1 text-sm text-slate-700">
                      {m.acoes.map((a) => (
                        <li key={a.id} className="flex gap-2">
                          <span className={a.done ? "text-emerald-600" : "text-slate-400"}>{a.done ? "☑" : "☐"}</span>
                          <span>
                            {a.title}
                            {a.responsavel || a.dueDate ? (
                              <span className="text-slate-500">
                                {a.responsavel ? ` · com ${a.responsavel}` : ""}
                                {a.dueDate ? ` · até ${formatFullDate(a.dueDate)}` : ""}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ))}
          </section>
        ) : (
          <section className={secao}>
            <p className="text-sm text-slate-500">As metas ainda estão sendo escritas pelo RH.</p>
          </section>
        )}

        {combinados.length > 0 ? (
          <section className={secao}>
            <h2 className={tituloDaSecao}>O que combinamos nas conversas</h2>
            <ul className="space-y-2 text-sm text-slate-700">
              {combinados.map((c) => (
                <li key={c.id}>
                  <span className="font-medium">{formatFullDate(c.data)}:</span>{" "}
                  <span className="whitespace-pre-wrap">{c.combinados}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {plano.status === "EM_ANDAMENTO" && (plano.proximaConversa || encontros.length > 0) ? (
          <section className={secao}>
            <h2 className={tituloDaSecao}>Próximos encontros</h2>
            {plano.proximaConversa ? (
              <p className="text-sm text-slate-700">
                Próxima conversa marcada: <strong>{formatFullDate(plano.proximaConversa)}</strong>
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-slate-700">
                {encontros.map((d) => (
                  <li key={d}>{formatFullDate(dayKeyToDate(d))}</li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <div className="no-print flex flex-wrap items-center justify-end gap-3 pt-1">
          <span className="text-xs text-slate-500">Para guardar, use o botão e escolha &ldquo;Salvar como PDF&rdquo;.</span>
          <PrintButton />
        </div>
      </div>
    </PaginaDoCandidato>
  );
}
