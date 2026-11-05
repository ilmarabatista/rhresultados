import { requireSession } from "@/lib/session";
import { empresasDaAdmissao, listaDeAdmissoes } from "@/lib/admissao-dados";
import AdmissaoNova from "@/components/admissao-nova";
import AdmissoesLista from "@/components/admissoes-lista";
import { TituloDaSecao } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assinatura de carteira — RH Resultados" };

/**
 * Assinatura de carteira de todas as empresas: os dados vão ao médico do
 * trabalho, o funcionário manda o ASO e os documentos pelo link, e sai o
 * pacote organizado para a contabilidade.
 */
export default async function AdmissoesPage() {
  await requireSession();
  const [empresas, lista] = await Promise.all([empresasDaAdmissao(), listaDeAdmissoes()]);

  return (
    <main className="mx-auto max-w-5xl space-y-3.5 px-4 py-5 sm:px-6">
      <TituloDaSecao antes="Assinatura de" destaque="carteira" />
      <AdmissaoNova empresas={empresas} />
      <AdmissoesLista lista={lista} mostrarEmpresa />
    </main>
  );
}
