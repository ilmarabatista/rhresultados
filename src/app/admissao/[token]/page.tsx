import { prisma } from "@/lib/prisma";
import { AvisoAoCandidato, PaginaDoCandidato } from "@/components/public-candidate-page";
import AdmissaoDocumentos from "@/components/admissao-documentos";
import AdmissaoTerminar from "@/components/admissao-terminar";
import { DOCUMENTOS_ADMISSIONAIS, textoDaConsulta } from "@/lib/admissao";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Documentos da admissão",
  robots: { index: false, follow: false },
};

/** Rota pública: o funcionário manda o ASO e os documentos da admissão. */
export default async function AdmissaoPublicaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const a = await prisma.admissao.findUnique({
    where: { token },
    select: {
      nome: true,
      pacoteGeradoEm: true,
      documentosEnviadosEm: true,
      exameData: true,
      exameHora: true,
      exameLocal: true,
      company: { select: { name: true } },
      documentos: { orderBy: { criadoEm: "asc" }, select: { id: true, tipo: true, nome: true, mime: true, enviadoPor: true } },
    },
  });

  if (!a) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhuma admissão. Confira o link recebido." />;
  }
  if (a.pacoteGeradoEm) {
    return <AvisoAoCandidato titulo="Documentos recebidos" texto="O RH já recebeu os seus documentos e mandou para a contabilidade. Obrigado!" />;
  }

  const consulta = textoDaConsulta({ data: a.exameData, hora: a.exameHora, local: a.exameLocal });
  const tipos = new Set(a.documentos.map((d) => d.tipo));
  const faltando = DOCUMENTOS_ADMISSIONAIS.filter((d) => d.obrigatorio && !tipos.has(d.chave)).map((d) => d.nome);

  return (
    <PaginaDoCandidato
      empresa={a.company.name}
      titulo="Documentos para assinar a sua carteira"
      subtitulo={a.nome}
      instrucoes={[
        "Depois do exame admissional, tire a foto do atestado (ASO) que o médico entregou e mande no primeiro item.",
        "Para cada documento, toque em Tirar foto. Se o documento tem frente e verso, mande as duas fotos no mesmo item.",
        "Fotografe em lugar claro, com o documento inteiro aparecendo e sem reflexo.",
        "Pode mandar aos poucos: o que você mandou fica guardado. Quando terminar, toque em Terminei.",
      ]}
    >
      {consulta ? (
        <section className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-4">
          <p className="text-micro font-semibold uppercase tracking-wider text-brand-700">Seu exame admissional</p>
          <p className="mt-1 text-sm font-medium text-slate-800">{consulta.charAt(0).toUpperCase() + consulta.slice(1)}.</p>
          <p className="mt-1 text-xs text-slate-600">Leve um documento com foto. Depois do exame, mande aqui a foto do atestado (ASO).</p>
        </section>
      ) : null}
      <AdmissaoDocumentos
        modo={{ quem: "funcionario", token, aberto: true }}
        arquivos={a.documentos.map((d) => ({ id: d.id, tipo: d.tipo, nome: d.nome, mime: d.mime, doFuncionario: d.enviadoPor === "FUNCIONARIO" }))}
      />
      <AdmissaoTerminar token={token} faltando={faltando} terminado={!!a.documentosEnviadosEm} />
    </PaginaDoCandidato>
  );
}
