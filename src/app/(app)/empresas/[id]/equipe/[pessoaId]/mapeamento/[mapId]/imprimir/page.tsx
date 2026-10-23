import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import { lerDados, ROTULO_DA_CRITICIDADE, ROTULO_DA_PERIODICIDADE } from "@/lib/mapeamento";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapeamento para imprimir — RH Resultados" };

const h2 = "mb-2 text-sm font-semibold uppercase tracking-wider text-brand-800";
const th = "border border-slate-200 px-2 py-1 text-left";
const td = "border border-slate-200 px-2 py-1 align-top";

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="break-inside-avoid">
      <p className="font-semibold">{rotulo}</p>
      <p className="whitespace-pre-wrap text-slate-700">{valor || "—"}</p>
    </div>
  );
}

/**
 * O mapeamento numa folha, para revisar com a pessoa e assinar. A via do
 * colaborador sai sem as observações do RH; a via do RH sai completa.
 */
export default async function ImprimirMapeamentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pessoaId: string; mapId: string }>;
  searchParams: Promise<{ via?: string }>;
}) {
  await requireSession();
  const { id, pessoaId, mapId } = await params;
  const viaDoRh = (await searchParams).via === "rh";

  const m = await prisma.mapeamentoDeRotina.findFirst({
    where: { id: mapId, employeeId: pessoaId, companyId: id },
    include: { employee: { select: { name: true } }, company: { select: { name: true } } },
  });
  if (!m) notFound();
  const d = lerDados(m.dados);
  const base = `/empresas/${id}/equipe/${pessoaId}/mapeamento/${mapId}`;

  return (
    <main className="mx-auto max-w-4xl space-y-5 bg-white p-6 text-slate-800 print:p-0">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href={base} className="text-sm text-slate-500 hover:text-slate-900">
          ← Voltar ao mapeamento
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`${base}/imprimir`} className={viaDoRh ? "text-slate-500 hover:underline" : "font-semibold text-brand-800"}>
            Via do colaborador
          </Link>
          <Link href={`${base}/imprimir?via=rh`} className={viaDoRh ? "font-semibold text-brand-800" : "text-slate-500 hover:underline"}>
            Via do RH (com observações)
          </Link>
          <PrintButton />
        </div>
      </div>

      <header className="border-b-2 border-brand-900 pb-3">
        <p className="text-micro uppercase tracking-wider text-slate-500">
          Mapeamento de processos · {m.company.name} · uso interno, confidencial
        </p>
        <h1 className="mt-1 text-xl font-semibold">{m.employee.name}</h1>
        <p className="text-sm text-slate-600">
          {[d.cargo, d.setor].filter(Boolean).join(" · ") || "—"}
          {d.tempoNoCargo ? ` · ${d.tempoNoCargo} no cargo` : ""}
        </p>
        <p className="mt-1 text-mini text-slate-500">
          Entrevista em {m.dataDaEntrevista ? formatFullDate(m.dataDaEntrevista) : "—"}
          {m.entrevistador ? ` por ${m.entrevistador}` : ""}
        </p>
        <p className="mt-2 text-mini text-slate-500">
          As informações servem para estruturar o manual de processos da clínica e facilitar a chegada de novos colaboradores.
        </p>
      </header>

      <section className="space-y-2 text-mini">
        <h2 className={h2}>Visão geral da função</h2>
        <Linha rotulo="Resumo da função" valor={d.resumo} />
        <Linha rotulo="Principal entregável" valor={d.entregavel} />
        <Linha rotulo="Com quem mais se relaciona" valor={d.relacionamentos} />
      </section>

      <section className="text-mini">
        <h2 className={h2}>Processos e tarefas</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className={`${th} w-8`}>Nº</th>
              <th className={th}>Descrição</th>
              <th className={`${th} w-28`}>Periodicidade</th>
              <th className={`${th} w-24`}>Criticidade</th>
            </tr>
          </thead>
          <tbody>
            {d.tarefas.length ? (
              d.tarefas.map((t, i) => (
                <tr key={i} className="break-inside-avoid">
                  <td className={`${td} text-center`}>{i + 1}</td>
                  <td className={td}>{t.descricao}</td>
                  <td className={td}>{t.periodicidade ? ROTULO_DA_PERIODICIDADE[t.periodicidade] : "—"}</td>
                  <td className={td}>{t.criticidade ? ROTULO_DA_CRITICIDADE[t.criticidade] : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={td} colSpan={4}>
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {d.tarefaExclusiva ? <p className="mt-2 whitespace-pre-wrap">{d.tarefaExclusiva}</p> : null}
      </section>

      <section className="space-y-2 text-mini">
        <h2 className={h2}>Passo a passo do processo principal</h2>
        <Linha rotulo="Processo" valor={d.processoNome} />
        {d.processoExemplo ? <Linha rotulo="Exemplo real" valor={d.processoExemplo} /> : null}
        <ol className="space-y-1">
          {d.passos.map((p, i) => (
            <li key={i} className="break-inside-avoid">
              <strong>Passo {i + 1}.</strong> {p}
            </li>
          ))}
        </ol>
        <Linha rotulo="O que fazer quando algo dá errado" valor={d.quandoDaErrado} />
      </section>

      <section className="text-mini">
        <h2 className={h2}>Ferramentas, sistemas e acessos</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className={th}>Ferramenta / sistema</th>
              <th className={th}>Para que usa</th>
              <th className={th}>Nível de acesso</th>
            </tr>
          </thead>
          <tbody>
            {d.ferramentas.map((f, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={td}>{f.nome}</td>
                <td className={td}>{f.uso || "—"}</td>
                <td className={td}>{f.acesso || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <Linha rotulo="Acesso a dado sensível ou financeiro" valor={d.dadoSensivel} />
        </div>
      </section>

      <section className="space-y-2 text-mini">
        <h2 className={h2}>Conhecimento crítico e informal</h2>
        <Linha rotulo="O que uma pessoa nova precisaria saber para substituir por um dia" valor={d.substituir} />
        <Linha rotulo="Contato externo que só a pessoa gerencia" valor={d.contatoExterno} />
        <Linha rotulo="Regra não documentada aplicada no dia a dia" valor={d.regraNaoEscrita} />
      </section>

      <section className="text-mini">
        <h2 className={h2}>Gargalos, riscos e oportunidades de melhoria</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className={th}>Situação de risco / gargalo</th>
              <th className={th}>O que acontece / sugestão de melhoria</th>
            </tr>
          </thead>
          <tbody>
            {d.gargalos.map((g, i) => (
              <tr key={i} className="break-inside-avoid">
                <td className={`${td} whitespace-pre-wrap`}>{g.situacao}</td>
                <td className={`${td} whitespace-pre-wrap`}>{g.impacto || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2">
          <Linha rotulo="O que poderia melhorar no setor" valor={d.melhoriaDoSetor} />
        </div>
      </section>

      <section className="space-y-2 text-mini">
        <h2 className={h2}>Indicadores e metas do cargo</h2>
        <Linha rotulo="Como sabe que fez um bom trabalho" valor={d.bomTrabalho} />
        <Linha rotulo="Meta ou número que acompanha" valor={d.metaAcompanhada} />
        <Linha rotulo="Como mediria a qualidade do trabalho" valor={d.qualidade} />
      </section>

      {viaDoRh ? (
        <section className="space-y-2 rounded border border-amber-300 bg-amber-50/50 p-3 text-mini">
          <h2 className={h2}>Observações da gerente de RH · não compartilhar com o colaborador</h2>
          <Linha rotulo="Impressões gerais" valor={d.rhImpressoes} />
          <Linha rotulo="Pontos de atenção" valor={d.rhAtencao} />
          <Linha rotulo="Próximos passos" valor={d.rhProximosPassos} />
        </section>
      ) : null}

      <section className="break-inside-avoid text-mini">
        <h2 className={h2}>Validação e assinaturas</h2>
        <p className="mb-6 text-slate-600">
          Documento revisado pelo colaborador e de acordo com as informações coletadas. Depois de validado, fica arquivado nos
          processos da empresa.
        </p>
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="border-t border-slate-500 pt-1">Colaborador: confirmo as informações acima</div>
            <p className="mt-1 text-slate-500">Data: ____ / ____ / ______</p>
          </div>
          <div>
            <div className="border-t border-slate-500 pt-1">Gerente de RH: documento revisado e aprovado</div>
            <p className="mt-1 text-slate-500">Data: ____ / ____ / ______</p>
          </div>
        </div>
        <p className="mt-4 text-slate-500">
          Versão {m.versao} · próxima revisão prevista: {m.proximaRevisao ? formatFullDate(m.proximaRevisao) : "____ / ____ / ______"}
        </p>
      </section>
    </main>
  );
}
