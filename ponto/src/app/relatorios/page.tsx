import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { nomeDoMes } from "@/lib/calculo";
import { Cartao, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatórios — Ponto" };

export default async function RelatoriosPage() {
  const s = await exigirColaborador();
  const lista = await prisma.relatorio.findMany({
    where: { colaboradorId: s.id },
    orderBy: { mes: "desc" },
    select: { mes: true, enviadoEm: true, cienteEm: true },
  });
  return (
    <>
      <Topo titulo="Ponto" nome={s.nome} links={[{ href: "/", rotulo: "Registrar" }, { href: "/folgas", rotulo: "Folgas" }]} />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-900">Meus relatórios de ponto</h1>
        <Cartao>
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">O RH ainda não enviou nenhum relatório.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.map((r) => (
                <li key={r.mes}>
                  <Link href={`/relatorios/${r.mes}`} className="flex items-center justify-between py-3 hover:text-marca-700">
                    <span className="inline-block font-medium first-letter:uppercase">{nomeDoMes(r.mes)}</span>
                    {r.cienteEm ? <Etiqueta tom="bom">conferido</Etiqueta> : <Etiqueta tom="atencao">conferir</Etiqueta>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </main>
    </>
  );
}
