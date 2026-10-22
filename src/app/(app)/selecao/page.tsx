import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { listarCargosParaVaga, listarModelos, listarVagas } from "@/lib/selecao-dados";
import { TituloDaSecao } from "@/components/ui";
import SelecaoVagas from "@/components/selecao-vagas";
import SelecaoModelos from "@/components/selecao-modelos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seleção — RH Resultados" };

/** Todas as vagas, de todas as empresas, e os modelos de processo. */
export default async function SelecaoPage() {
  await requireSession();

  const [vagas, modelos, empresas, cargos] = await Promise.all([
    listarVagas(),
    listarModelos(),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    listarCargosParaVaga(),
  ]);

  return (
    <div className="space-y-4">
      <TituloDaSecao antes="Processo seletivo" destaque="vagas em andamento" />

      <SelecaoVagas
        vagas={vagas}
        empresas={empresas.map((e) => ({ id: e.id, nome: e.name }))}
        modelos={modelos.map((m) => ({ id: m.id, nome: m.nome, etapas: m.etapas.length }))}
        cargos={cargos}
      />

      <SelecaoModelos modelos={modelos} />
    </div>
  );
}
