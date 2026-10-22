import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import { comparativo, formatarNota, lerStatus, NOME_DO_STATUS, porcentagem, variacao } from "@/lib/clima";
import { ciclosDaEmpresa } from "@/lib/clima-dados";
import ClimaCiclos from "@/components/clima-ciclos";
import { Etiqueta, Painel, Tabela, TituloDaSecao, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clima — RH Resultados" };

const TOM_DO_STATUS = { RASCUNHO: "neutro", ABERTA: "azul", ENCERRADA: "bom", HISTORICO: "neutro" } as const;

/**
 * A pesquisa de clima da empresa: os ciclos, do mais novo ao mais antigo, e o
 * comparativo das dimensões entre eles.
 */
export default async function ClimaDaEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [pesquisas, ciclos, temBiblioteca] = await Promise.all([
    prisma.pesquisaDeClima.findMany({
      where: { companyId: id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        nome: true,
        status: true,
        abertaEm: true,
        prazo: true,
        convidados: true,
        _count: { select: { respostas: true, perguntas: true } },
      },
    }),
    ciclosDaEmpresa(id),
    prisma.perguntaDeClima.count({ where: { padrao: true, companyId: null } }),
  ]);

  const tabela = comparativo(ciclos);
  const sugestaoDeNome = `Clima ${new Date().getFullYear()}`;

  return (
    <div className="space-y-3.5">
      <TituloDaSecao antes="Pesquisa de" destaque="clima" acao={<ClimaCiclos companyId={id} sugestaoDeNome={sugestaoDeNome} />} />

      {temBiblioteca === 0 && pesquisas.length === 0 ? (
        <Vazio acao={<Link href="/clima" className="text-sm font-medium text-brand-700 hover:text-brand-800">Abrir a biblioteca ›</Link>}>
          A biblioteca de perguntas ainda está vazia. Carregue a biblioteca inicial antes do primeiro ciclo.
        </Vazio>
      ) : null}

      {pesquisas.length === 0 ? (
        temBiblioteca ? <Vazio>Nenhum ciclo ainda. Crie o primeiro em “Novo ciclo”.</Vazio> : null
      ) : (
        <Tabela titulo="Ciclos" minLargura={640}>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-micro uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">Ciclo</th>
                <th className="px-3 py-1.5 font-medium">Situação</th>
                <th className="px-3 py-1.5 font-medium">Aplicação</th>
                <th className="px-3 py-1.5 text-right font-medium">Respostas</th>
                <th className="px-3 py-1.5 text-right font-medium">Média geral</th>
                <th className="px-3 py-1.5 text-right font-medium">eNPS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pesquisas.map((p) => {
                const status = lerStatus(p.status);
                const ciclo = ciclos.find((c) => c.id === p.id);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-1.5">
                      <Link href={`/empresas/${id}/clima/${p.id}`} className="font-medium text-brand-700 hover:text-brand-900">
                        {p.nome}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5">
                      <Etiqueta tom={TOM_DO_STATUS[status]}>{NOME_DO_STATUS[status]}</Etiqueta>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {status === "HISTORICO"
                        ? p.abertaEm?.getUTCFullYear()
                        : p.abertaEm
                          ? `${formatFullDate(p.abertaEm)}${p.prazo ? ` até ${formatFullDate(p.prazo)}` : ""}`
                          : `${p._count.perguntas} perguntas`}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">
                      {status === "HISTORICO" ? "—" : p._count.respostas}
                      {status !== "HISTORICO" && p.convidados ? (
                        <span className="text-slate-400"> · {porcentagem(p._count.respostas, p.convidados)}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-slate-800">{formatarNota(ciclo?.geral ?? null)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{ciclo?.enps ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Tabela>
      )}

      {ciclos.length >= 2 ? (
        <Painel titulo="Comparativo entre ciclos" descricao="Média de cada dimensão por ciclo. A seta compara o último ciclo com o anterior.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-xs">
              <thead className="text-left text-micro uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Dimensão</th>
                  {ciclos.map((c) => (
                    <th key={c.id} className="px-2 py-1 text-right font-medium">{c.nome}</th>
                  ))}
                  <th className="py-1 pl-2 text-right font-medium">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabela.map((linha) => {
                  const n = linha.valores.length;
                  const v = variacao(linha.valores[n - 1], linha.valores[n - 2]);
                  return (
                    <tr key={linha.dimensao}>
                      <td className="py-1 pr-3 text-slate-700">{linha.dimensao}</td>
                      {linha.valores.map((valor, i) => (
                        <td key={i} className="px-2 py-1 text-right tabular-nums text-slate-700">{formatarNota(valor)}</td>
                      ))}
                      <td className={`py-1 pl-2 text-right font-medium tabular-nums ${v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {v === null ? "—" : v > 0 ? `▲ ${formatarNota(v)}` : v < 0 ? `▼ ${formatarNota(-v)}` : "="}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Painel>
      ) : null}
    </div>
  );
}
