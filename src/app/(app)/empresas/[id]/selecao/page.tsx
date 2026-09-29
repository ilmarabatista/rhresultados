import { requireSession } from "@/lib/session";
import { listarModelos, listarVagas } from "@/lib/selecao-dados";
import SelecaoVagas from "@/components/selecao-vagas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seleção — RH Resultados" };

/** As vagas desta empresa. Os modelos de processo ficam no menu Seleção. */
export default async function SelecaoDaEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [vagas, modelos] = await Promise.all([listarVagas(id), listarModelos()]);

  return (
    <SelecaoVagas
      vagas={vagas}
      empresas={[]}
      empresaFixa={id}
      modelos={modelos.map((m) => ({ id: m.id, nome: m.nome, etapas: m.etapas.length }))}
    />
  );
}
