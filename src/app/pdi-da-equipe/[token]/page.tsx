import { prisma } from "@/lib/prisma";
import { lerLinkDoPdiDaEquipe } from "@/lib/pdi-link";
import { formatFullDate } from "@/lib/dates";
import { progressoDoPlano } from "@/lib/pdi";
import { foraDoPdi } from "@/lib/prestadores";
import { cidadesDaEquipe } from "@/components/filtro-cidade";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import PrintButton from "@/components/print-button";
import { BarraDeAndamento, CAIXA, CombinadosDasConversas, MetaCombinada, SELECT_DO_COMBINADO } from "@/components/pdi-combinado";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "PDI da equipe",
  robots: { index: false, follow: false },
};

/**
 * Rota pública: o que foi combinado no PDI de cada pessoa, para a gerente
 * acompanhar. Só leitura, sempre com o estado do dia. Sem as notas da
 * avaliação, que ficam só no RH.
 */
export default async function PdiDaEquipePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await lerLinkDoPdiDaEquipe(token);
  const empresa = link
    ? await prisma.company.findUnique({
        where: { id: link.companyId },
        select: {
          name: true,
          branches: { orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }], select: { id: true, name: true } },
          employees: {
            where: { status: { not: "DESLIGADO" } },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              role: true,
              branchId: true,
              plans: {
                where: { status: "EM_ANDAMENTO" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                  id: true,
                  objective: true,
                  startDate: true,
                  endDate: true,
                  proximaConversa: true,
                  ...SELECT_DO_COMBINADO,
                },
              },
            },
          },
        },
      })
    : null;

  if (!link || !empresa) {
    return <AvisoAoCandidato titulo="Link indisponível" texto="Este link não é válido ou já venceu. Peça um novo ao RH." />;
  }

  const doPdi = empresa.employees.filter((p) => !foraDoPdi(p.role));
  const { cidades, atual, naCidade } = cidadesDaEquipe(empresa.branches, doPdi, link.cidade ?? undefined);
  const daqui = doPdi.filter((p) => naCidade(p.branchId));
  const comPlano = daqui.filter((p) => p.plans[0]);
  const semPlano = daqui.filter((p) => !p.plans[0]);
  const onde = atual ? (cidades.find((c) => c.id === atual)?.nome ?? "sem cidade no cadastro") : null;

  return (
    <PaginaDoCandidato
      empresa={empresa.name}
      titulo={`PDI da equipe${onde ? ` · ${onde}` : ""}`}
      subtitulo={`O que foi combinado com cada pessoa · atualizado em ${formatFullDate(new Date())}`}
    >
      <div className="space-y-3">
        <section className={CAIXA}>
          <p className="text-sm leading-relaxed text-slate-600">
            Aqui está o que foi combinado na conversa 1 a 1 de cada pessoa: as metas, o que ela vai fazer, quem
            acompanha e os prazos. Este link mostra sempre como está hoje.
          </p>
          <p className="mt-2 text-sm text-slate-800">
            <strong>
              {comPlano.length} de {daqui.length}
            </strong>{" "}
            pessoas têm PDI em andamento.
          </p>
          {comPlano.length > 0 ? (
            <ol className="no-print mt-3 flex flex-wrap gap-1.5">
              {comPlano.map((p) => (
                <li key={p.id}>
                  <a
                    href={`#p-${p.id}`}
                    className="block rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:border-brand-300"
                  >
                    {p.name}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        {comPlano.map((p) => {
          const plano = p.plans[0]!;
          const progresso = progressoDoPlano(plano.metas);
          const periodo =
            plano.startDate || plano.endDate
              ? `${plano.startDate ? formatFullDate(plano.startDate) : "—"} a ${plano.endDate ? formatFullDate(plano.endDate) : "—"}`
              : null;
          return (
            <section key={p.id} id={`p-${p.id}`} className={`${CAIXA} scroll-mt-4 break-before-auto`}>
              <h2 className="text-base font-semibold text-slate-900">{p.name}</h2>
              <p className="text-xs text-slate-500">{[p.role, periodo].filter(Boolean).join(" · ")}</p>
              {plano.objective ? (
                <p className="mt-2 text-sm text-slate-800">
                  <strong>Objetivo:</strong> {plano.objective}
                </p>
              ) : null}
              {progresso != null ? (
                <div className="mt-3">
                  <BarraDeAndamento progresso={progresso} />
                </div>
              ) : null}

              {plano.metas.length > 0 ? (
                <div className="mt-4 space-y-4 border-t border-slate-100 pt-3">
                  {plano.metas.map((m, i) => (
                    <MetaCombinada key={m.id} m={m} n={i + 1} pessoa="ela" />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">As metas ainda estão sendo escritas pelo RH.</p>
              )}

              {plano.conversas.some((c) => c.combinados?.trim()) ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Combinados nas conversas</p>
                  <CombinadosDasConversas conversas={plano.conversas} />
                </div>
              ) : null}

              <p className="mt-3 text-sm text-slate-700">
                Próxima conversa:{" "}
                <strong>{plano.proximaConversa ? formatFullDate(plano.proximaConversa) : "ainda sem data"}</strong>
              </p>
            </section>
          );
        })}

        {semPlano.length > 0 ? (
          <section className={CAIXA}>
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              Ainda sem PDI em andamento ({semPlano.length} de {daqui.length})
            </h2>
            <p className="text-sm text-slate-600">{semPlano.map((p) => p.name).join(", ")}</p>
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
