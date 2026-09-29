import { prisma } from "@/lib/prisma";
import { INSTRUCOES_DISC } from "@/lib/disc";
import { lerTesteCadastrado, semChave } from "@/lib/testes-cadastrados";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import PublicDiscForm from "@/components/public-disc-form";
import PublicCustomTestForm from "@/components/public-custom-test-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Teste",
  robots: { index: false, follow: false },
};

/** Rota pública: o teste que a consultoria mandou por link. */
export default async function TestePublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const envio = await prisma.testeEnviado.findUnique({
    where: { token },
    select: { tipo: true, status: true, estrutura: true, pessoa: true, company: { select: { name: true } } },
  });

  if (!envio) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhum teste. Confira o link recebido." />;
  }
  if (envio.status === "RESPONDIDO") {
    return <AvisoAoCandidato titulo="Teste já respondido" texto="Recebemos as suas respostas. Obrigado!" />;
  }

  if (envio.tipo === "DISC") {
    return (
      <PaginaDoCandidato empresa={envio.company?.name ?? null} titulo="Perfil comportamental (DISC)" subtitulo={envio.pessoa} instrucoes={INSTRUCOES_DISC}>
        <PublicDiscForm token={token} />
      </PaginaDoCandidato>
    );
  }

  const teste = lerTesteCadastrado(envio.estrutura);
  if (!teste) {
    return <AvisoAoCandidato titulo="Teste indisponível" texto="Este teste ainda não tem questões. Fale com quem enviou o link." />;
  }

  return (
    <PaginaDoCandidato
      empresa={envio.company?.name ?? null}
      titulo={teste.nome}
      subtitulo={envio.pessoa}
      instrucoes={teste.instrucoes ? teste.instrucoes.split(/\r?\n/).filter(Boolean) : undefined}
    >
      <PublicCustomTestForm token={token} modo={teste.modo} questoes={semChave(teste)} />
    </PaginaDoCandidato>
  );
}
