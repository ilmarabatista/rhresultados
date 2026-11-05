import { requireSession } from "@/lib/session";
import { empresasDaAdmissao, listaDeAdmissoes } from "@/lib/admissao-dados";
import AdmissaoNova from "@/components/admissao-nova";
import AdmissoesLista from "@/components/admissoes-lista";
import { TituloDaSecao } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assinatura de carteira — RH Resultados" };

/** As admissões desta empresa. */
export default async function AdmissoesDaEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const [empresas, lista] = await Promise.all([empresasDaAdmissao(), listaDeAdmissoes(id)]);

  return (
    <div className="space-y-3.5">
      <TituloDaSecao antes="Assinatura de" destaque="carteira" />
      <AdmissaoNova empresas={empresas} empresaInicial={id} />
      <AdmissoesLista lista={lista} mostrarEmpresa={false} />
    </div>
  );
}
