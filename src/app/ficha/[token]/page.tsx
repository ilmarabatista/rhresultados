import { prisma } from "@/lib/prisma";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import PublicFichaForm from "@/components/public-ficha-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Ficha de solicitação de emprego",
  robots: { index: false, follow: false },
};

/** Rota pública: a ficha de solicitação de emprego que a consultoria mandou por link. */
export default async function FichaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const c = await prisma.candidate.findUnique({
    where: { applicationToken: token },
    select: {
      name: true,
      applicationAnsweredAt: true,
      jobOpening: { select: { title: true } },
      company: { select: { name: true } },
    },
  });

  if (!c) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhuma ficha. Confira o link recebido." />;
  }
  if (c.applicationAnsweredAt) {
    return <AvisoAoCandidato titulo="Ficha enviada" texto="Recebemos a sua ficha. Obrigado! Entraremos em contato sobre as próximas etapas." />;
  }

  return (
    <PaginaDoCandidato
      empresa={c.company?.name ?? null}
      titulo="Ficha de solicitação de emprego"
      subtitulo={c.jobOpening ? `Vaga de ${c.jobOpening.title}` : null}
    >
      <PublicFichaForm token={token} nome={c.name} cargo={c.jobOpening?.title ?? ""} empresa={c.company?.name ?? null} />
    </PaginaDoCandidato>
  );
}
