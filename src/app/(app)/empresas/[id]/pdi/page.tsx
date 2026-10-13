import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, formatFullDate, todayKey } from "@/lib/dates";
import {
  gapsPrioritarios,
  lerTipoDeCompetencia,
  progressoDoPlano,
  resumoDaAvaliacao,
  situacaoDaConversa,
} from "@/lib/pdi";
import { Aviso, Etiqueta, Numeros, Tabela, Vazio } from "@/components/ui";
import PdiCargos from "@/components/pdi-cargos";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDI — RH Resultados" };

const ABAS = [
  { slug: "equipe", rotulo: "Equipe" },
  { slug: "cargos", rotulo: "Descrições de cargo" },
] as const;

/**
 * O PDI da empresa: quem já tem plano, onde cada um está e quando é a próxima
 * conversa; e as descrições de cargo, que dizem que competências cada cargo
 * pede — o ponto de partida de toda avaliação.
 */
export default async function PdiPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; cargo?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const aba = sp.aba === "cargos" ? "cargos" : "equipe";
  const hoje = todayKey();

  const [pessoas, cargos] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: id, status: { not: "DESLIGADO" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        cargo: { select: { _count: { select: { competencias: true } } } },
        avaliacoes: {
          orderBy: { data: "desc" },
          take: 1,
          select: {
            data: true,
            notas: { select: { nome: true, esperado: true, pessoa: true, avaliador: true, acordado: true } },
          },
        },
        plans: {
          where: { status: "EM_ANDAMENTO" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            endDate: true,
            proximaConversa: true,
            metas: { select: { status: true, progresso: true } },
          },
        },
        _count: { select: { plans: { where: { status: "CONCLUIDO" } } } },
      },
    }),
    prisma.cargo.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        missao: true,
        responsabilidades: true,
        requisitos: true,
        competencias: { orderBy: [{ ordem: "asc" }, { nome: "asc" }] },
        _count: { select: { colaboradores: { where: { status: { not: "DESLIGADO" } } } } },
      },
    }),
  ]);

  const linhas = pessoas.map((p) => {
    const avaliacao = p.avaliacoes[0] ?? null;
    const plano = p.plans[0] ?? null;
    const resumo = avaliacao ? resumoDaAvaliacao(avaliacao.notas) : null;
    const proxima = plano?.proximaConversa ? dateToDayKey(plano.proximaConversa) : null;
    return {
      id: p.id,
      nome: p.name,
      cargo: p.role,
      cargoDescrito: (p.cargo?._count.competencias ?? 0) > 0,
      avaliadaEm: avaliacao ? formatFullDate(avaliacao.data) : null,
      gaps: avaliacao ? gapsPrioritarios(avaliacao.notas).map((n) => n.nome) : [],
      aderencia: resumo?.aderencia ?? null,
      plano: plano
        ? {
            metas: plano.metas.length,
            atingidas: plano.metas.filter((m) => m.status === "ATINGIDA").length,
            progresso: progressoDoPlano(plano.metas),
            fim: plano.endDate ? formatFullDate(plano.endDate) : null,
          }
        : null,
      proxima: proxima ? formatFullDate(plano!.proximaConversa) : null,
      situacao: plano ? situacaoDaConversa(proxima, hoje) : null,
      concluidos: p._count.plans,
    };
  });

  const comPlano = linhas.filter((l) => l.plano).length;
  const atrasadas = linhas.filter((l) => l.situacao === "ATRASADA").length;
  const semData = linhas.filter((l) => l.situacao === "SEM_DATA").length;
  const cargosSemDescricao = cargos.filter((c) => c._count.colaboradores > 0 && c.competencias.length === 0).length;

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">PDI</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Plano de Desenvolvimento Individual. A descrição do cargo diz as competências e o nível esperado; a avaliação,
          feita junto com a pessoa, mostra os gaps; os gaps escolhidos viram metas SMART com ações; e cada conversa de
          acompanhamento registra o avanço.
        </p>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.slug}
            href={`?aba=${a.slug}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              aba === a.slug
                ? "border-brand-600 font-semibold text-brand-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {a.rotulo}
            {a.slug === "cargos" && cargosSemDescricao > 0 ? (
              <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800">
                {cargosSemDescricao}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {aba === "cargos" ? (
        <PdiCargos
          companyId={id}
          selecionado={sp.cargo ?? null}
          cargos={cargos.map((c) => ({
            id: c.id,
            nome: c.nome,
            pessoas: c._count.colaboradores,
            missao: c.missao ?? "",
            responsabilidades: c.responsabilidades ?? "",
            requisitos: c.requisitos ?? "",
            competencias: c.competencias.map((k) => ({
              id: k.id,
              nome: k.nome,
              tipo: lerTipoDeCompetencia(k.tipo),
              descricao: k.descricao ?? "",
              nivelEsperado: k.nivelEsperado,
            })),
          }))}
        />
      ) : (
        <div className="space-y-3">
          <Numeros
            colunas={4}
            itens={[
              { rotulo: "Com PDI em andamento", valor: `${comPlano}/${linhas.length}`, detalhe: "pessoas ativas e afastadas" },
              {
                rotulo: "Conversas atrasadas",
                valor: atrasadas,
                tom: atrasadas > 0 ? "ruim" : "neutro",
                detalhe: "a data marcada passou",
              },
              {
                rotulo: "Sem próxima conversa",
                valor: semData,
                tom: semData > 0 ? "atencao" : "neutro",
                detalhe: "plano sem data de acompanhamento",
              },
              {
                rotulo: "Cargos sem descrição",
                valor: cargosSemDescricao,
                tom: cargosSemDescricao > 0 ? "atencao" : "bom",
                detalhe: "com gente e sem competências",
              },
            ]}
          />

          {cargosSemDescricao > 0 ? (
            <Aviso rotulo="Antes de avaliar">
              Para avaliar alguém, o cargo da pessoa precisa ter as competências descritas.{" "}
              <Link href="?aba=cargos" className="font-medium underline">
                Descrever os cargos
              </Link>
            </Aviso>
          ) : null}

          {linhas.length === 0 ? (
            <Vazio>Ninguém na equipe ainda. Cadastre as pessoas na aba Equipe.</Vazio>
          ) : (
            <Tabela titulo="Equipe" direita={`${linhas.length} pessoas`} minLargura={860}>
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_5rem] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                <span>Pessoa</span>
                <span>Avaliação</span>
                <span>Gaps</span>
                <span>Plano</span>
                <span>Próxima conversa</span>
                <span />
              </div>
              {linhas.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_5rem] items-center gap-3 border-b border-slate-100 px-3 py-1.5 text-[13px] last:border-b-0 even:bg-slate-50/60 hover:bg-brand-50/40"
                >
                  <div className="min-w-0">
                    <Link href={`/empresas/${id}/pdi/${l.id}`} className="block truncate font-medium text-slate-800 hover:text-brand-700">
                      {l.nome}
                    </Link>
                    <span className="block truncate text-[11px] text-slate-400">
                      {l.cargo ?? "sem cargo"}
                      {l.cargo && !l.cargoDescrito ? " · cargo sem descrição" : ""}
                    </span>
                  </div>
                  <div className="text-[12px] text-slate-600">
                    {l.avaliadaEm ? (
                      <>
                        {l.avaliadaEm}
                        {l.aderencia != null ? (
                          <span className="block text-[11px] text-slate-400">{l.aderencia}% do esperado</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">não avaliada</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1">
                    {l.gaps.slice(0, 3).map((g) => (
                      <Etiqueta key={g} tom="atencao">
                        {g}
                      </Etiqueta>
                    ))}
                    {l.gaps.length > 3 ? <span className="text-[11px] text-slate-400">+{l.gaps.length - 3}</span> : null}
                    {l.avaliadaEm && l.gaps.length === 0 ? <Etiqueta tom="bom">sem gaps</Etiqueta> : null}
                  </div>
                  <div className="text-[12px]">
                    {l.plano ? (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-brand-600" style={{ width: `${l.plano.progresso ?? 0}%` }} />
                          </div>
                          <span className="tabular-nums text-slate-600">{l.plano.progresso ?? 0}%</span>
                        </div>
                        <span className="block text-[11px] text-slate-400">
                          {l.plano.atingidas}/{l.plano.metas} metas{l.plano.fim ? ` · até ${l.plano.fim}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">
                        sem plano{l.concluidos > 0 ? ` · ${l.concluidos} concluído(s)` : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px]">
                    {l.situacao === "ATRASADA" ? (
                      <Etiqueta tom="ruim">{l.proxima} · atrasada</Etiqueta>
                    ) : l.situacao === "PROXIMA" ? (
                      <Etiqueta tom="atencao">{l.proxima}</Etiqueta>
                    ) : l.situacao === "EM_DIA" ? (
                      <span className="text-slate-600">{l.proxima}</span>
                    ) : l.situacao === "SEM_DATA" ? (
                      <span className="text-amber-700">marcar</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </div>
                  <Link
                    href={`/empresas/${id}/pdi/${l.id}`}
                    className="justify-self-end rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-brand-700 transition hover:border-brand-300"
                  >
                    {l.plano || l.avaliadaEm ? "Abrir" : "Começar"}
                  </Link>
                </div>
              ))}
            </Tabela>
          )}
        </div>
      )}
    </main>
  );
}
