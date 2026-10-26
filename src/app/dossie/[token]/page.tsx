import { prisma } from "@/lib/prisma";
import { lerLinkDoDossie } from "@/lib/dossie-link";
import { carregarPastaDoCandidato } from "@/lib/selecao-dados";
import { AvisoAoCandidato } from "@/components/public-candidate-page";
import PrintButton from "@/components/print-button";
import DossieDoCandidato from "@/components/dossie-do-candidato";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Dossiê do candidato — RH Resultados",
  robots: { index: false, follow: false },
};

/** Rota pública: o dossiê que a consultoria mandou ao cliente pelo WhatsApp. */
export default async function DossiePublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const candidatoId = await lerLinkDoDossie(token);
  const vaga = candidatoId ? await prisma.candidate.findUnique({ where: { id: candidatoId }, select: { jobOpeningId: true } }) : null;
  const c = vaga?.jobOpeningId && candidatoId ? await carregarPastaDoCandidato(vaga.jobOpeningId, candidatoId) : null;

  if (!c || !c.jobOpening) {
    return (
      <AvisoAoCandidato
        titulo="Link indisponível"
        texto="Este link do dossiê não é válido ou já venceu (ele vale por 30 dias). Peça um novo à consultoria."
      />
    );
  }

  return (
    <DossieDoCandidato
      c={c}
      link={token}
      barra={
        <>
          <span className="text-micro text-slate-500">Para guardar, use o botão e escolha &ldquo;Salvar como PDF&rdquo;.</span>
          <PrintButton />
        </>
      }
    />
  );
}
