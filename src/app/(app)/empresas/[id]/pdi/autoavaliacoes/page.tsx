import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate, todayKey, dateToDayKey } from "@/lib/dates";
import { lerPerguntas, lerRespostas, modeloSugerido, resumoDaAutoavaliacao } from "@/lib/autoavaliacao";
import PdiAbas from "@/components/pdi-abas";
import { foraDoPdi } from "@/lib/prestadores";
import AutoavaliacaoModelos from "@/components/autoavaliacao-modelos";
import FiltroCidade, { cidadesDaEquipe } from "@/components/filtro-cidade";
import AutoavaliacaoEnvios, { type PessoaNoEnvio } from "@/components/autoavaliacao-envios";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autoavaliações — RH Resultados" };

/**
 * O controle das autoavaliações: a equipe toda com a situação de cada um
 * (sem link, aguardando, respondida, no PDI) e, embaixo, os modelos por função.
 */
export default async function AutoavaliacoesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cidade?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const hoje = todayKey();

  const [modelos, cargos, equipe, unidades] = await Promise.all([
    prisma.modeloDeAutoavaliacao.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        cargoId: true,
        updatedAt: true,
        cargo: { select: { nome: true } },
        _count: { select: { perguntas: true, enviadas: true } },
      },
    }),
    prisma.cargo.findMany({ where: { companyId: id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.employee.findMany({
      where: { companyId: id, status: { not: "DESLIGADO" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        cargoId: true,
        branchId: true,
        phone: true,
        cargo: { select: { nome: true } },
        // Só a mais recente: é ela que diz em que pé a pessoa está.
        autoavaliacoes: {
          orderBy: { enviadoEm: "desc" },
          take: 1,
          select: {
            id: true,
            token: true,
            titulo: true,
            status: true,
            prazo: true,
            enviadoEm: true,
            respondidoEm: true,
            avaliacaoId: true,
            perguntas: true,
            respostas: true,
          },
        },
        plans: { where: { status: "EM_ANDAMENTO" }, select: { id: true }, take: 1 },
      },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const comPerguntas = modelos.filter((m) => m._count.perguntas > 0);
  // Dentistas e laboratório não fazem autoavaliação.
  const doPdi = equipe.filter((p) => !foraDoPdi(p.cargo?.nome ?? p.role));
  const { cidades, semCidade, atual: cidade, naCidade } = cidadesDaEquipe(unidades, doPdi, sp.cidade);
  const pessoas: PessoaNoEnvio[] = doPdi.filter((p) => naCidade(p.branchId)).map((p) => {
    const a = p.autoavaliacoes[0];
    let envio: PessoaNoEnvio["envio"] = null;
    if (a) {
      const perguntas = lerPerguntas(a.perguntas);
      const resumo = resumoDaAutoavaliacao(perguntas, lerRespostas(perguntas, a.respostas));
      envio = {
        id: a.id,
        token: a.token,
        titulo: a.titulo,
        status: a.status,
        enviadoEm: formatFullDate(a.enviadoEm),
        deHoje: dateToDayKey(a.enviadoEm) === hoje,
        respondidoEm: a.respondidoEm ? formatFullDate(a.respondidoEm) : null,
        prazo: a.prazo ? formatFullDate(a.prazo) : null,
        atrasado: a.status === "ENVIADO" && a.prazo != null && dateToDayKey(a.prazo) < hoje,
        marcados: resumo.respondidos,
        itens: resumo.itens,
        atencao: resumo.atencao,
        avaliacaoId: a.avaliacaoId,
      };
    }
    return {
      id: p.id,
      nome: p.name,
      funcao: p.cargo?.nome ?? p.role,
      telefone: p.phone,
      sugerido: modeloSugerido(comPerguntas, p)?.id ?? "",
      envio,
      temPlano: p.plans.length > 0,
    };
  });

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">PDI</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          A autoavaliação é o ponto de partida do PDI. Gere o link de cada pessoa, mande pelo WhatsApp, acompanhe quem já
          respondeu e, com a resposta, siga para a avaliação e o plano de 3 meses da conversa 1 a 1.
        </p>
        <div className="mt-4">
          <PdiAbas companyId={id} atual="autoavaliacoes" cidade={cidade} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Envios e respostas</h2>
        <FiltroCidade
          base={`/empresas/${id}/pdi/autoavaliacoes`}
          cidades={cidades}
          atual={cidade}
          total={doPdi.length}
          semCidade={semCidade}
        />
        <AutoavaliacaoEnvios
          companyId={id}
          pessoas={pessoas}
          modelos={modelos.map((m) => ({ id: m.id, nome: m.nome, perguntas: m._count.perguntas }))}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Modelos por função</h2>
        <AutoavaliacaoModelos
          companyId={id}
          cargos={cargos}
          modelos={modelos.map((m) => ({
            id: m.id,
            nome: m.nome,
            cargo: m.cargo?.nome ?? null,
            perguntas: m._count.perguntas,
            enviadas: m._count.enviadas,
            atualizado: formatFullDate(m.updatedAt),
          }))}
        />
      </section>
    </main>
  );
}
