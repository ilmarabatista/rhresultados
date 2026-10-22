import { prisma } from "@/lib/prisma";
import { formatFullDate } from "@/lib/dates";
import { INSTRUCOES_DO_QUESTIONARIO, lerNivelDeCargo, lerRespostas, questionarioDoNivel } from "@/lib/cargos";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import QuestionarioDeCargoForm from "@/components/questionario-de-cargo-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Questionário de cargo",
  robots: { index: false, follow: false },
};

/** Rota pública: o questionário de cargo que a consultoria mandou por link. */
export default async function QuestionarioPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const q = await prisma.questionarioDeCargo.findUnique({
    where: { token },
    select: {
      nivel: true,
      status: true,
      pessoa: true,
      prazo: true,
      respostas: true,
      cargo: { select: { nome: true, company: { select: { name: true } } } },
    },
  });
  const nivel = q ? lerNivelDeCargo(q.nivel) : null;

  if (!q || !nivel) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhum questionário. Confira o link recebido." />;
  }
  if (q.status === "RESPONDIDO") {
    return <AvisoAoCandidato titulo="Questionário enviado" texto="Recebemos as suas respostas. Obrigado!" />;
  }

  return (
    <PaginaDoCandidato
      empresa={q.cargo.company.name}
      titulo={`Questionário do cargo: ${q.cargo.nome}`}
      subtitulo={`${q.pessoa}${q.prazo ? ` · responder até ${formatFullDate(q.prazo)}` : ""}`}
      instrucoes={INSTRUCOES_DO_QUESTIONARIO}
    >
      <QuestionarioDeCargoForm token={token} secoes={questionarioDoNivel(nivel)} iniciais={lerRespostas(nivel, q.respostas)} />
    </PaginaDoCandidato>
  );
}
