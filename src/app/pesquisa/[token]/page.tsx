import { prisma } from "@/lib/prisma";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import { lerPerfil, ordenar } from "@/lib/clima";
import { paraAplicada } from "@/lib/clima-dados";
import { AvisoAoCandidato } from "@/components/public-candidate-page";
import PublicClimaForm from "@/components/public-clima-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pesquisa de clima",
  robots: { index: false, follow: false },
};

const INTRODUCAO_PADRAO =
  "Esta pesquisa quer conhecer a sua opinião sobre a empresa e o seu trabalho, para melhorarmos juntos o ambiente. Ela é anônima: ninguém fica sabendo quem respondeu o quê. Responda com sinceridade.";

/** Rota pública: a pesquisa de clima que a empresa divulgou para a equipe. */
export default async function PesquisaPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const pesquisa = await prisma.pesquisaDeClima.findUnique({
    where: { token },
    select: {
      status: true,
      prazo: true,
      introducao: true,
      perfil: true,
      perguntas: true,
      company: { select: { name: true } },
    },
  });

  if (!pesquisa || pesquisa.status === "RASCUNHO" || pesquisa.status === "HISTORICO") {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhuma pesquisa aberta. Confira o link recebido." />;
  }
  if (pesquisa.status !== "ABERTA" || (pesquisa.prazo && pesquisa.prazo < dayKeyToDate(todayKey()))) {
    return <AvisoAoCandidato titulo="Pesquisa encerrada" texto="O prazo para responder esta pesquisa terminou. Obrigado pelo interesse!" />;
  }

  return (
    <PublicClimaForm
      token={token}
      empresa={pesquisa.company.name}
      introducao={pesquisa.introducao || INTRODUCAO_PADRAO}
      perfil={lerPerfil(pesquisa.perfil)}
      perguntas={ordenar(pesquisa.perguntas.map(paraAplicada))}
    />
  );
}
