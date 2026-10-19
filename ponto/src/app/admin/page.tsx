import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/sessao";
import { empresasDoRh } from "@/lib/integracao";
import { todayKey } from "@/lib/dates";
import { FormNovaEmpresa } from "@/components/admin";
import { Cartao, Erro, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresas — Ponto" };

export default async function AdminPage() {
  const s = await exigirAdmin();
  const [empresas, rh] = await Promise.all([
    prisma.empresa.findMany({
      orderBy: { nome: "asc" },
      include: { _count: { select: { colaboradores: { where: { ativo: true } } } } },
    }),
    empresasDoRh(),
  ]);
  const jaTem = new Set(empresas.map((e) => e.rhCompanyId));
  const disponiveis = rh.ok ? rh.empresas.filter((e) => !jaTem.has(e.id)) : [];

  return (
    <>
      <Topo titulo="Ponto · Administração" nome={s.nome} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <Cartao titulo="Empresas com ponto">
          {empresas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma empresa ainda. Crie o ponto da primeira logo abaixo.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {empresas.map((e) => (
                <li key={e.id}>
                  <Link href={`/admin/empresas/${e.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-marca-700">
                    <span className="font-medium">{e.nome}</span>
                    <span className="flex items-center gap-2 text-sm text-slate-500">
                      {e._count.colaboradores} colaborador{e._count.colaboradores === 1 ? "" : "es"}
                      {e.ativo ? null : <Etiqueta tom="ruim">desativado</Etiqueta>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Criar o ponto de uma empresa">
          {!rh.ok ? (
            <Erro texto={rh.erro} />
          ) : disponiveis.length === 0 ? (
            <p className="text-sm text-slate-500">Todas as empresas do RH já têm ponto.</p>
          ) : (
            <FormNovaEmpresa empresas={disponiveis} hoje={todayKey()} />
          )}
        </Cartao>
        <p className="text-center text-xs text-slate-500">
          Horários, ajustes de batidas e relatórios ficam no RH Resultados, dentro de cada empresa, na aba Ponto.
        </p>
      </main>
    </>
  );
}
