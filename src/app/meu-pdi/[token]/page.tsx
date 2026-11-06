import { prisma } from "@/lib/prisma";
import { lerLinkDoPdi } from "@/lib/pdi-link";
import { dateToDayKey, dayKeyToDate, formatFullDate, todayKey } from "@/lib/dates";
import { progressoDoPlano } from "@/lib/pdi";
import { calendarioDoPdi } from "@/lib/autoavaliacao";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import PrintButton from "@/components/print-button";
import { BarraDeAndamento, CombinadosDasConversas, MetaCombinada, SELECT_DO_COMBINADO, CAIXA } from "@/components/pdi-combinado";

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
          ...SELECT_DO_COMBINADO,
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

  const secao = CAIXA;
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
              <BarraDeAndamento progresso={progresso} />
            </div>
          ) : null}
        </section>

        {plano.metas.length > 0 ? (
          <section className="space-y-3">
            <h2 className="px-1 text-sm font-semibold text-slate-900">Minhas metas</h2>
            {plano.metas.map((m, i) => (
              <div key={m.id} className={secao}>
                <MetaCombinada m={m} n={i + 1} pessoa="eu" />
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
            <CombinadosDasConversas conversas={plano.conversas} />
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
