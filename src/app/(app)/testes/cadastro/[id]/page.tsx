import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { escreverEstrutura, lerTesteCadastrado } from "@/lib/testes-cadastrados";
import CustomTestEditor from "@/components/custom-test-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cadastro de teste — RH Resultados" };

/** Cadastrar (id "novo") ou editar um teste da consultoria. */
export default async function CadastroDeTestePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  if (id === "novo") {
    return (
      <CustomTestEditor
        teste={{ id: null, nome: "", instrucoes: "", modo: "ESCOLHA", estrutura: "", ativo: true, aplicado: 0 }}
      />
    );
  }

  const t = await prisma.customTest.findUnique({
    where: { id },
    include: { _count: { select: { testeEnviados: true } } },
  });
  if (!t) notFound();

  const lido = lerTesteCadastrado({
    nome: t.name,
    instrucoes: t.instructions,
    modo: t.mode,
    fatores: t.factors,
    pares: t.pairs,
    questoes: t.questions,
  });

  return (
    <CustomTestEditor
      teste={{
        id: t.id,
        nome: t.name,
        instrucoes: t.instructions ?? "",
        modo: t.mode === "NOTAS" ? "NOTAS" : "ESCOLHA",
        estrutura: lido ? escreverEstrutura(lido) : "",
        ativo: t.active,
        aplicado: t._count.testeEnviados,
      }}
    />
  );
}
