import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { chaveDaDimensao, formatarNota, lerOpcoes, lerTipo } from "@/lib/clima";
import { ciclosDaEmpresa } from "@/lib/clima-dados";
import ClimaBiblioteca from "@/components/clima-biblioteca";
import { Filtros, Painel, Tabela, TituloDaSecao, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pesquisa de clima — RH Resultados" };

/**
 * A pesquisa de clima do sistema todo: a biblioteca de onde as empresas montam
 * as suas pesquisas, e o comparativo entre as empresas, que é só da
 * consultoria. Nenhuma empresa vê o resultado de outra.
 */
export default async function ClimaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await requireSession();
  const { aba: abaPedida } = await searchParams;
  const aba = abaPedida === "empresas" ? "empresas" : "biblioteca";

  const dimensoes = await prisma.dimensaoDeClima.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: {
      perguntas: {
        where: { companyId: null },
        orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { usos: true } } },
      },
    },
  });

  const abas = (
    <Filtros
      itens={[
        { rotulo: "Biblioteca", href: "/clima", ativo: aba === "biblioteca" },
        { rotulo: "Comparar empresas", href: "/clima?aba=empresas", ativo: aba === "empresas" },
      ]}
    />
  );

  if (aba === "biblioteca") {
    return (
      <main className="mx-auto max-w-6xl space-y-3.5 px-4 py-5 sm:px-6">
        <TituloDaSecao antes="Pesquisa de" destaque="clima" acao={abas} />
        <ClimaBiblioteca
          dimensoes={dimensoes.map((d) => ({
            id: d.id,
            nome: d.nome,
            descricao: d.descricao ?? "",
            ativa: d.ativa,
            perguntas: d.perguntas.map((p) => ({
              id: p.id,
              enunciado: p.enunciado,
              tipo: lerTipo(p.tipo),
              opcoes: lerOpcoes(p.opcoes),
              maxEscolhas: p.maxEscolhas,
              enps: p.enps,
              padrao: p.padrao,
              ativa: p.ativa,
              usos: p._count.usos,
            })),
          }))}
        />
      </main>
    );
  }

  // O último ciclo com resultado de cada empresa.
  const empresas = await prisma.company.findMany({
    where: { pesquisasDeClima: { some: { status: { in: ["ABERTA", "ENCERRADA", "HISTORICO"] } } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const ultimos = (
    await Promise.all(
      empresas.map(async (e) => {
        const ciclos = await ciclosDaEmpresa(e.id);
        const ultimo = ciclos[ciclos.length - 1];
        return ultimo ? { empresa: e, ciclo: ultimo } : null;
      }),
    )
  ).filter((x): x is NonNullable<typeof x> => x !== null);

  const ordemDasDimensoes = dimensoes.map((d) => d.nome);
  const linhas = ordemDasDimensoes
    .map((nome) => {
      const valores = ultimos
        .map((u) => {
          for (const [n, m] of u.ciclo.medias) if (chaveDaDimensao(n) === chaveDaDimensao(nome)) return m;
          return null;
        })
        .filter((v): v is number => v !== null);
      if (valores.length === 0) return null;
      return {
        nome,
        media: valores.reduce((a, b) => a + b, 0) / valores.length,
        menor: Math.min(...valores),
        maior: Math.max(...valores),
        empresas: valores.length,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  return (
    <main className="mx-auto max-w-6xl space-y-3.5 px-4 py-5 sm:px-6">
      <TituloDaSecao antes="Pesquisa de" destaque="clima" acao={abas} />
      {ultimos.length === 0 ? (
        <Vazio>Nenhuma empresa tem resultado de clima ainda.</Vazio>
      ) : (
        <>
          <Painel>
            <p className="text-xs leading-relaxed text-slate-500">
              Usa o último ciclo com resultado de cada empresa. Serve para você dizer ao cliente como ele está em relação às
              empresas que atende, sem mostrar o nome de nenhuma outra.
            </p>
          </Painel>
          <Tabela titulo="Dimensões entre as empresas" direita={`${ultimos.length} empresas`} minLargura={520}>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-micro uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Dimensão</th>
                  <th className="px-3 py-1.5 text-right font-medium">Média</th>
                  <th className="px-3 py-1.5 text-right font-medium">Menor</th>
                  <th className="px-3 py-1.5 text-right font-medium">Maior</th>
                  <th className="px-3 py-1.5 text-right font-medium">Empresas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map((l) => (
                  <tr key={l.nome}>
                    <td className="px-3 py-1.5 text-slate-700">{l.nome}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatarNota(l.media)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{formatarNota(l.menor)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{formatarNota(l.maior)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{l.empresas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tabela>
          <Tabela titulo="Último ciclo de cada empresa" minLargura={520}>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-micro uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Empresa</th>
                  <th className="px-3 py-1.5 font-medium">Ciclo</th>
                  <th className="px-3 py-1.5 text-right font-medium">Média geral</th>
                  <th className="px-3 py-1.5 text-right font-medium">eNPS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ultimos.map((u) => (
                  <tr key={u.empresa.id}>
                    <td className="px-3 py-1.5">
                      <Link href={`/empresas/${u.empresa.id}/clima`} className="text-brand-700 hover:text-brand-900">
                        {u.empresa.name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{u.ciclo.nome}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatarNota(u.ciclo.geral)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{u.ciclo.enps ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tabela>
        </>
      )}
    </main>
  );
}
