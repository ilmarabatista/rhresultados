import { prisma } from "@/lib/prisma";
import { dadosParaAPessoa, lerDados } from "@/lib/mapeamento";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import MapeamentoForm from "@/components/mapeamento-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mapeamento de rotinas",
  robots: { index: false, follow: false },
};

/** Rota pública: o mapeamento de rotinas que a própria pessoa preenche pelo link. */
export default async function MapeamentoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const m = await prisma.mapeamentoDeRotina.findUnique({
    where: { token },
    select: { status: true, dados: true, employee: { select: { name: true, company: { select: { name: true } } } } },
  });

  if (!m) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhum mapeamento. Confira o link recebido." />;
  }
  if (m.status !== "ENVIADO") {
    return <AvisoAoCandidato titulo="Mapeamento enviado" texto="Recebemos o que você contou sobre a sua rotina. Obrigado!" />;
  }

  return (
    <PaginaDoCandidato empresa={m.employee.company.name} titulo="Mapeamento da sua rotina" subtitulo={m.employee.name}>
      <MapeamentoForm token={token} iniciais={dadosParaAPessoa(lerDados(m.dados))} />
    </PaginaDoCandidato>
  );
}
