import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { carregarPastaDoCandidato } from "@/lib/selecao-dados";
import PrintButton from "@/components/print-button";
import DossieDoCandidato from "@/components/dossie-do-candidato";
import EnviarDossie from "@/components/enviar-dossie";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossiê do candidato — RH Resultados" };

/** O dossiê dentro do sistema: a prévia do que o cliente recebe, com imprimir e mandar pelo WhatsApp. */
export default async function DossiePage({
  params,
  searchParams,
}: {
  params: Promise<{ vagaId: string; candidatoId: string }>;
  searchParams: Promise<{ pdf?: string }>;
}) {
  await requireSession();
  const { vagaId, candidatoId } = await params;
  const { pdf } = await searchParams;
  const c = await carregarPastaDoCandidato(vagaId, candidatoId);
  if (!c || !c.jobOpening) notFound();

  return (
    <DossieDoCandidato
      c={c}
      imprimir={pdf === "1"}
      barra={
        <>
          <Link href={`/selecao/${c.jobOpening.id}/candidato/${c.id}`} className="text-micro text-slate-500 hover:text-brand-700">
            ← voltar à pasta
          </Link>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-micro text-slate-500">É assim que o cliente recebe.</span>
            <EnviarDossie candidatoId={c.id} />
            <PrintButton />
          </span>
        </>
      }
    />
  );
}
