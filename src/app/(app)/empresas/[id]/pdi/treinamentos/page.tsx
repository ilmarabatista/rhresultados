import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import PdiAbas from "@/components/pdi-abas";
import PrintButton from "@/components/print-button";
import { foraDoPdi } from "@/lib/prestadores";
import FiltroCidade, { cidadesDaEquipe } from "@/components/filtro-cidade";
import { OPCOES, LEGENDA_DA_ESCALA } from "@/lib/autoavaliacao";
import { SOBRE_O_DESTINO, separarPontos, type Ponto } from "@/lib/pontos-marcados";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDI, setor e reunião geral — RH Resultados" };

/**
 * Os pontos marcados nas autoavaliações, separados: o que é de todos (reunião
 * geral), o que é de um setor (treinamento de setor) e o que é de uma pessoa
 * só (PDI). Conta a autoavaliação respondida mais recente de cada pessoa.
 */
export default async function TreinamentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cidade?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const [equipe, unidades] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: id, status: { not: "DESLIGADO" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
        cargo: { select: { nome: true } },
        autoavaliacoes: {
          where: { status: "RESPONDIDO" },
          orderBy: { respondidoEm: "desc" },
          take: 1,
          select: { titulo: true, perguntas: true, respostas: true },
        },
      },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const doPdi = equipe.filter((p) => !foraDoPdi(p.cargo?.nome ?? p.role));
  const { cidades, semCidade, atual: cidade, naCidade } = cidadesDaEquipe(unidades, doPdi, sp.cidade);
  const naTela = doPdi.filter((p) => naCidade(p.branchId));
  const respondidas = naTela.flatMap((p) => {
    const a = p.autoavaliacoes[0];
    return a ? [{ pessoaId: p.id, nome: p.name, funcao: a.titulo, perguntas: a.perguntas, respostas: a.respostas }] : [];
  });
  const s = separarPontos(respondidas);
  const nomeDaCidade = cidade ? (cidades.find((c) => c.id === cidade)?.nome ?? "Sem cidade") : null;
  const totalSetor = s.setor.reduce((n, x) => n + x.pontos.length, 0);
  const totalPdi = s.pdi.reduce((n, f) => n + f.pessoas.reduce((m, p) => m + p.pontos.length, 0), 0);

  return (
    <main className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">PDI</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Os pontos que as pessoas marcaram na autoavaliação, separados pelo lugar certo de tratar cada um: o que se repete
          em várias funções vai para a reunião geral, o que se repete numa função vai para o treinamento do setor, e o que
          só uma pessoa marcou fica no PDI dela.
        </p>
        <div className="mt-4">
          <PdiAbas companyId={id} atual="treinamentos" cidade={cidade} />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="print:hidden">
            <FiltroCidade
              base={`/empresas/${id}/pdi/treinamentos`}
              cidades={cidades}
              atual={cidade}
              total={doPdi.length}
              semCidade={semCidade}
            />
          </div>
          <p className="text-sm text-slate-600">
            {nomeDaCidade ? <strong>{nomeDaCidade}: </strong> : null}
            {s.respondidas} de {naTela.length} pessoas responderam à autoavaliação
            {s.funcoes.length > 0 ? ` (${s.funcoes.map((f) => `${f.funcao} ${f.pessoas}`).join(", ")})` : ""}.
          </p>
        </div>
        <PrintButton />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Como ler</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Ponto marcado</strong> é o item em que a pessoa se viu abaixo do esperado: nota 1 ou 2 ({LEGENDA_DA_ESCALA}),
            tarefa que faz com ajuda ou quer aprender, ou conduta que aconteceu às vezes ou frequentemente no último mês.
          </li>
          {(["GERAL", "SETOR", "PDI"] as const).map((d) => (
            <li key={d}>
              <strong>{SOBRE_O_DESTINO[d].titulo}:</strong> {SOBRE_O_DESTINO[d].regra}
            </li>
          ))}
          <li>
            &quot;X de Y&quot; quer dizer: X pessoas marcaram o item, de Y que responderam a ele. Conta a autoavaliação
            mais recente de cada pessoa.
          </li>
        </ul>
      </section>

      {s.respondidas === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Ainda não há autoavaliação respondida{nomeDaCidade ? " nesta cidade" : ""}.
        </p>
      ) : (
        <>
          <Bloco titulo={SOBRE_O_DESTINO.GERAL.titulo} regra={SOBRE_O_DESTINO.GERAL.regra} total={s.geral.length} cor="violet">
            {s.geral.length === 0 ? (
              <Nada />
            ) : (
              <ol className="divide-y divide-slate-100">
                {s.geral.map((p) => (
                  <li key={p.chave} className="break-inside-avoid py-2.5">
                    <Item ponto={p} />
                    <p className="mt-1 text-mini text-slate-500">
                      {p.porFuncao
                        .filter((f) => f.marcaram > 0)
                        .map((f) => `${f.funcao}: ${f.marcaram} de ${f.de}`)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Bloco>

          <Bloco titulo={SOBRE_O_DESTINO.SETOR.titulo} regra={SOBRE_O_DESTINO.SETOR.regra} total={totalSetor} cor="sky">
            {s.setor.length === 0 ? (
              <Nada />
            ) : (
              <div className="space-y-4">
                {s.setor.map((f) => (
                  <div key={f.funcao} className="break-inside-avoid">
                    <h3 className="text-sm font-semibold text-slate-800">
                      {f.funcao}{" "}
                      <span className="font-normal text-slate-500">
                        · {f.pessoas} {f.pessoas === 1 ? "pessoa respondeu" : "pessoas responderam"} · {f.pontos.length}{" "}
                        {f.pontos.length === 1 ? "ponto" : "pontos"}
                      </span>
                    </h3>
                    <ol className="mt-1 divide-y divide-slate-100">
                      {f.pontos.map((p) => (
                        <li key={p.chave} className="py-2">
                          <Item ponto={p} />
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </Bloco>

          <Bloco titulo={SOBRE_O_DESTINO.PDI.titulo} regra={SOBRE_O_DESTINO.PDI.regra} total={totalPdi} cor="emerald">
            {s.pdi.length === 0 ? (
              <Nada />
            ) : (
              <div className="space-y-4">
                {s.pdi.map((f) => (
                  <div key={f.funcao}>
                    <h3 className="text-sm font-semibold text-slate-800">{f.funcao}</h3>
                    <ul className="mt-1 space-y-2">
                      {f.pessoas.map((pessoa) => (
                        <li key={pessoa.pessoaId} className="break-inside-avoid rounded-lg bg-slate-50 px-3 py-2">
                          <Link
                            href={`/empresas/${id}/pdi/${pessoa.pessoaId}`}
                            className="text-sm font-medium text-brand-700 hover:underline"
                          >
                            {pessoa.nome}
                          </Link>
                          <ul className="mt-1 space-y-0.5">
                            {pessoa.pontos.map((p) => (
                              <li key={p.chave} className="text-sm text-slate-700">
                                <span className="mr-1.5 text-micro uppercase tracking-wider text-slate-400">{p.secao}</span>
                                {p.texto}{" "}
                                <span className="text-slate-500">({p.marcacoes[0].resposta.toLowerCase()})</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Bloco>
        </>
      )}
    </main>
  );
}

const CORES = {
  violet: "border-violet-200 bg-violet-50 text-violet-900",
  sky: "border-sky-200 bg-sky-50 text-sky-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
} as const;

function Bloco({
  titulo,
  regra,
  total,
  cor,
  children,
}: {
  titulo: string;
  regra: string;
  total: number;
  cor: keyof typeof CORES;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className={`border-b px-4 py-3 ${CORES[cor]}`}>
        <h2 className="text-base font-semibold">
          {titulo} <span className="font-normal opacity-70">· {total} {total === 1 ? "ponto" : "pontos"}</span>
        </h2>
        <p className="text-sm opacity-80">{regra}</p>
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

function Item({ ponto }: { ponto: Ponto }) {
  const opcoes = ponto.tipo === "ABERTA" ? [] : OPCOES[ponto.tipo];
  const marcadas = opcoes.filter((o) => o.nivel != null && o.nivel < 3).map((o) => o.rotulo.toLowerCase());
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm text-slate-800">
          <span className="mr-1.5 text-micro uppercase tracking-wider text-slate-400">{ponto.secao}</span>
          {ponto.texto}
        </p>
        {ponto.tipo === "TAREFA" || ponto.tipo === "CONDUTA" ? (
          <p className="text-micro text-slate-400">Conta quem marcou: {marcadas.join(" ou ")}</p>
        ) : null}
      </div>
      <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-mini font-medium text-slate-700">
        {ponto.marcaram} de {ponto.de}
      </span>
    </div>
  );
}

function Nada() {
  return <p className="text-sm text-slate-500">Nenhum ponto aqui.</p>;
}
