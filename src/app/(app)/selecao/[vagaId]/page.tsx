import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { carregarVaga } from "@/lib/selecao-dados";
import { TituloDaSecao } from "@/components/ui";
import SelecaoQuadro from "@/components/selecao-quadro";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vaga — RH Resultados" };

/** O quadro de uma vaga: as etapas em colunas, com os candidatos. */
export default async function VagaPage({ params }: { params: Promise<{ vagaId: string }> }) {
  await requireSession();
  const { vagaId } = await params;
  const vaga = await carregarVaga(vagaId);
  if (!vaga) notFound();

  return (
    <div className="space-y-4">
      <TituloDaSecao
        antes={vaga.empresa ? `${vaga.empresa.nome} ·` : "Vaga de"}
        destaque={vaga.titulo}
        acao={
          <span className="flex gap-3">
            {vaga.empresa ? (
              <Link href={`/empresas/${vaga.empresa.id}/selecao`} className="text-[11px] text-slate-500 hover:text-brand-700">
                ← vagas de {vaga.empresa.nome}
              </Link>
            ) : null}
            <Link href="/selecao" className="text-[11px] text-slate-500 hover:text-brand-700">
              ← todas as vagas
            </Link>
          </span>
        }
      />

      <SelecaoQuadro
        vagaId={vaga.id}
        vaga={vaga.titulo}
        empresa={vaga.empresa?.nome ?? null}
        etapas={vaga.etapas}
        candidatos={vaga.candidatos}
        funil={vaga.funil}
        testesDisponiveis={vaga.testesDisponiveis}
      />
    </div>
  );
}
