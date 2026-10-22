import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import {
  apurar,
  chaveDaDimensao,
  classificar,
  comparativo,
  conclusaoSugerida,
  formatarNota,
  lerConclusoes,
  lerStatusDaAcao,
  NOME_DO_STATUS_DA_ACAO,
  porcentagem,
  variacao,
} from "@/lib/clima";
import { carregarPesquisa, ciclosDaEmpresa } from "@/lib/clima-dados";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório de clima — RH Resultados" };

/**
 * O relatório do ciclo, pronto para imprimir ou salvar em PDF: a régua, o
 * resumo das dimensões, cada dimensão com o gráfico de dentro e abaixo do
 * esperado, a conclusão e as ações, o eNPS, as perguntas de escolha, as
 * sugestões revisadas e o comparativo com os ciclos anteriores.
 */
export default async function RelatorioDeClimaPage({ params }: { params: Promise<{ id: string; pesquisaId: string }> }) {
  await requireSession();
  const { id, pesquisaId } = await params;

  const dados = await carregarPesquisa(pesquisaId);
  if (!dados || dados.pesquisa.companyId !== id || dados.pesquisa.status === "HISTORICO") notFound();
  const { pesquisa, regua, perguntas, respostas } = dados;

  const [empresa, ciclos] = await Promise.all([
    prisma.company.findUnique({ where: { id }, select: { name: true } }),
    ciclosDaEmpresa(id),
  ]);
  const apuracao = apurar(perguntas, respostas, regua);
  const conclusoes = lerConclusoes(pesquisa.conclusoes);

  const quando = (pesquisa.abertaEm ?? pesquisa.createdAt).getTime();
  const ate = ciclos.filter((c) => c.quando.getTime() <= quando || c.id === pesquisaId);
  const anterior = [...ate].reverse().find((c) => c.id !== pesquisaId) ?? null;
  const mediaAnterior = (dimensao: string) => {
    if (!anterior) return null;
    for (const [nome, m] of anterior.medias) if (chaveDaDimensao(nome) === chaveDaDimensao(dimensao)) return m;
    return null;
  };
  const tabela = comparativo(ate);

  const comNota = apuracao.dimensoes.filter((d) => d.media !== null);
  const escolhas = apuracao.dimensoes.flatMap((d) => d.perguntas.filter((r) => r.pergunta.tipo === "ESCOLHA" || r.pergunta.tipo === "MULTIPLA"));
  const textos = dados.textos.filter((t) => !t.ocultar).map((t) => t.textoRevisado ?? t.texto);

  return (
    <div className="mx-auto max-w-4xl space-y-5 bg-white p-6 text-slate-800 print:max-w-none print:p-0">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href={`/empresas/${id}/clima/${pesquisaId}?aba=plano`} className="text-xs text-slate-500 hover:text-brand-700">
          ‹ Voltar às conclusões
        </Link>
        <PrintButton />
      </div>

      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs uppercase tracking-[0.12em] text-brand-600">{empresa?.name}</p>
        <h1 className="text-xl font-semibold">Relatório de pesquisa de clima</h1>
        <p className="mt-1 text-sm text-slate-600">
          {pesquisa.nome}
          {pesquisa.abertaEm ? ` · aplicada de ${formatFullDate(pesquisa.abertaEm)}` : ""}
          {pesquisa.encerradaEm ? ` a ${formatFullDate(pesquisa.encerradaEm)}` : pesquisa.prazo ? ` a ${formatFullDate(pesquisa.prazo)}` : ""}
          {` · ${apuracao.respostas} respostas`}
          {pesquisa.convidados ? ` (${porcentagem(apuracao.respostas, pesquisa.convidados)} de ${pesquisa.convidados} convidados)` : ""}
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Média geral</p>
          <p className="text-2xl font-semibold tabular-nums text-brand-800">{formatarNota(apuracao.geral)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-micro font-medium uppercase tracking-wider text-slate-500">eNPS</p>
          <p className="text-2xl font-semibold tabular-nums text-brand-800">{apuracao.enps?.valor ?? "—"}</p>
          {apuracao.enps ? (
            <p className="text-micro text-slate-500">
              {porcentagem(apuracao.enps.promotores, apuracao.enps.respostas)} promotores ·{" "}
              {porcentagem(apuracao.enps.detratores, apuracao.enps.respostas)} críticos
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-xs leading-relaxed text-slate-600">
          <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Classificação</p>
          <p><strong className="text-emerald-700">Dentro do esperado:</strong> média igual ou maior que {formatarNota(regua)}</p>
          <p><strong className="text-amber-700">Abaixo do esperado:</strong> média menor que {formatarNota(regua)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">Resumo das dimensões</h2>
        <table className="w-full text-xs">
          <thead className="border-b border-slate-200 text-left text-micro uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1 font-medium">Dimensão</th>
              <th className="py-1 text-right font-medium">Média</th>
              <th className="py-1 text-right font-medium">Dentro do esperado</th>
              {anterior ? <th className="py-1 text-right font-medium">Desde {anterior.nome}</th> : null}
              <th className="py-1 pl-3 font-medium">Classificação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {comNota.map((d) => {
              const c = classificar(d.media, regua);
              const v = variacao(d.media, mediaAnterior(d.dimensao));
              return (
                <tr key={d.dimensao}>
                  <td className="py-1">{d.dimensao}</td>
                  <td className="py-1 text-right font-semibold tabular-nums">{formatarNota(d.media)}</td>
                  <td className="py-1 text-right tabular-nums">{porcentagem(d.dentro, d.dentro + d.abaixo)}</td>
                  {anterior ? (
                    <td className={`py-1 text-right tabular-nums ${v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {v === null ? "—" : v > 0 ? `+${formatarNota(v)}` : v < 0 ? `−${formatarNota(-v)}` : "="}
                    </td>
                  ) : null}
                  <td className={`py-1 pl-3 ${c === "ABAIXO" ? "text-amber-700" : "text-emerald-700"}`}>
                    {c === "ABAIXO" ? "Abaixo do esperado" : "Dentro do esperado"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {comNota.map((d) => {
        const total = d.dentro + d.abaixo;
        const pctDentro = total ? Math.round((d.dentro / total) * 100) : 0;
        const acoes = pesquisa.acoes.filter((a) => a.dimensao === d.dimensao);
        return (
          <section key={d.dimensao} className="break-inside-avoid rounded-lg border border-slate-200">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-900">{d.dimensao}</h3>
              <p className="text-sm">
                Média da dimensão: <strong className="tabular-nums">{formatarNota(d.media)}</strong>
              </p>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
              {/* O gráfico do modelo: a parte das notas dentro e abaixo do esperado. */}
              <div className="flex h-32 gap-4 border-b border-l border-slate-200 px-3 pt-1">
                <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-micro font-semibold tabular-nums text-emerald-700">{pctDentro}%</span>
                  <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(2, pctDentro)}%` }} />
                </div>
                <div className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-micro font-semibold tabular-nums text-amber-700">{total ? 100 - pctDentro : 0}%</span>
                  <div className="w-full rounded-t bg-amber-400" style={{ height: `${Math.max(2, total ? 100 - pctDentro : 0)}%` }} />
                </div>
              </div>
              <div className="space-y-2 text-xs leading-relaxed">
                <div className="flex gap-4 text-micro text-slate-500">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500" />Dentro/acima do esperado</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400" />Abaixo do esperado</span>
                </div>
                <ul className="space-y-0.5 text-slate-600">
                  {d.perguntas
                    .filter((r) => r.pergunta.tipo === "NOTA")
                    .map((r) => (
                      <li key={r.pergunta.id} className="flex justify-between gap-3">
                        <span>{r.pergunta.enunciado}</span>
                        <span className="shrink-0 tabular-nums">{formatarNota(r.media)}</span>
                      </li>
                    ))}
                </ul>
                <p className="whitespace-pre-line">
                  <strong>Conclusão:</strong> {conclusoes[d.dimensao] || conclusaoSugerida(d.media, regua)}
                </p>
                {acoes.length ? (
                  <div>
                    <strong>Ações:</strong>
                    <ul className="ml-4 list-disc">
                      {acoes.map((a) => (
                        <li key={a.id}>
                          {a.descricao}
                          {a.responsavel ? ` · ${a.responsavel}` : ""}
                          {a.prazo ? ` · até ${formatFullDate(a.prazo)}` : ""}
                          {` · ${NOME_DO_STATUS_DA_ACAO[lerStatusDaAcao(a.status)]}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}

      {escolhas.length ? (
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">Perguntas de escolha</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {escolhas.map((r) => (
              <div key={r.pergunta.id} className="rounded-lg border border-slate-200 p-3 text-xs">
                <p className="mb-1 font-medium">{r.pergunta.enunciado}</p>
                <ul className="space-y-0.5 text-slate-600">
                  {r.opcoes.map((o) => (
                    <li key={o.opcao} className="flex justify-between gap-2">
                      <span>{o.opcao}</span>
                      <span className="tabular-nums">{porcentagem(o.vezes, r.respostas)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {textos.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">Sugestões dos colaboradores</h2>
          <ul className="ml-4 list-disc space-y-1 text-xs leading-relaxed text-slate-700">
            {textos.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {ate.length >= 2 ? (
        <section className="break-inside-avoid">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800">Comparativo entre ciclos</h2>
          <table className="w-full text-xs">
            <thead className="border-b border-slate-200 text-left text-micro uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-1 font-medium">Dimensão</th>
                {ate.map((c) => (
                  <th key={c.id} className="py-1 text-right font-medium">{c.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tabela.map((l) => (
                <tr key={l.dimensao}>
                  <td className="py-1">{l.dimensao}</td>
                  {l.valores.map((v, i) => (
                    <td key={i} className="py-1 text-right tabular-nums">{formatarNota(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
