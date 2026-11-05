import { prisma } from "@/lib/prisma";
import { paraCampoDeData } from "@/lib/dates";
import { formatarCpf } from "@/lib/admissao";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import AdmissaoDadosForm from "@/components/admissao-dados-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Dados da admissão",
  robots: { index: false, follow: false },
};

/** Rota pública: o funcionário responde CPF, nascimento e função. */
export default async function DadosDaAdmissaoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await prisma.admissao.findUnique({
    where: { token },
    select: {
      nome: true,
      cpf: true,
      dataNascimento: true,
      funcao: true,
      dadosPreenchidosEm: true,
      pacoteGeradoEm: true,
      company: { select: { name: true, cargos: { orderBy: { nome: "asc" }, select: { nome: true } } } },
    },
  });

  if (!a) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhuma admissão. Confira o link recebido." />;
  }
  if (a.pacoteGeradoEm) {
    return <AvisoAoCandidato titulo="Dados recebidos" texto="O RH já tem os seus dados. Obrigado!" />;
  }

  return (
    <PaginaDoCandidato empresa={a.company.name} titulo="Seus dados para a admissão" subtitulo={a.nome}>
      <AdmissaoDadosForm
        token={token}
        respondido={!!a.dadosPreenchidosEm}
        cargos={a.company.cargos.map((c) => c.nome)}
        valores={{ cpf: a.cpf ? formatarCpf(a.cpf) : "", dataNascimento: paraCampoDeData(a.dataNascimento), funcao: a.funcao ?? "" }}
      />
    </PaginaDoCandidato>
  );
}
