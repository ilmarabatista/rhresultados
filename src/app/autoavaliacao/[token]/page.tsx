import { prisma } from "@/lib/prisma";
import { formatFullDate } from "@/lib/dates";
import { INSTRUCOES_PADRAO, lerPerguntas, lerRespostas } from "@/lib/autoavaliacao";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import AutoavaliacaoForm from "@/components/autoavaliacao-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Autoavaliação",
  robots: { index: false, follow: false },
};

/** Rota pública: a autoavaliação do PDI que o RH mandou por link. */
export default async function AutoavaliacaoPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const a = await prisma.autoavaliacao.findUnique({
    where: { token },
    select: {
      titulo: true,
      instrucoes: true,
      status: true,
      prazo: true,
      perguntas: true,
      respostas: true,
      employee: { select: { name: true, company: { select: { name: true } } } },
    },
  });

  if (!a) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhuma autoavaliação. Confira o link recebido." />;
  }
  if (a.status === "RESPONDIDO") {
    return <AvisoAoCandidato titulo="Autoavaliação enviada" texto="Recebemos as suas respostas. Obrigado!" />;
  }
  const perguntas = lerPerguntas(a.perguntas);

  return (
    <PaginaDoCandidato
      empresa={a.employee.company.name}
      titulo={`Autoavaliação · ${a.titulo}`}
      subtitulo={`${a.employee.name}${a.prazo ? ` · responder até ${formatFullDate(a.prazo)}` : ""}`}
    >
      <AutoavaliacaoForm
        token={token}
        instrucoes={a.instrucoes || INSTRUCOES_PADRAO}
        perguntas={perguntas}
        iniciais={lerRespostas(perguntas, a.respostas)}
      />
    </PaginaDoCandidato>
  );
}
