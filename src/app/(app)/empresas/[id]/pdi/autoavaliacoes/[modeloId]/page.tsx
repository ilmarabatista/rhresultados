import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { lerDestino, lerTipoDePergunta, TIPOS_DE_PERGUNTA } from "@/lib/autoavaliacao";
import AutoavaliacaoEditor from "@/components/autoavaliacao-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelo de autoavaliação — RH Resultados" };

/** Um modelo de autoavaliação: as perguntas de cada seção, para incluir, editar, mover e excluir. */
export default async function ModeloDeAutoavaliacaoPage({ params }: { params: Promise<{ id: string; modeloId: string }> }) {
  await requireSession();
  const { id, modeloId } = await params;

  const [modelo, cargos] = await Promise.all([
    prisma.modeloDeAutoavaliacao.findFirst({
      where: { id: modeloId, companyId: id },
      include: { perguntas: { orderBy: [{ ordem: "asc" }, { id: "asc" }] } },
    }),
    prisma.cargo.findMany({ where: { companyId: id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
  ]);
  if (!modelo) notFound();

  const perguntas = modelo.perguntas.flatMap((p) => {
    const tipo = lerTipoDePergunta(p.tipo);
    return tipo ? [{ id: p.id, tipo, texto: p.texto, destino: lerDestino(p.destino) }] : [];
  });
  perguntas.sort((a, b) => TIPOS_DE_PERGUNTA.indexOf(a.tipo) - TIPOS_DE_PERGUNTA.indexOf(b.tipo));

  return (
    <main className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/empresas/${id}/pdi/autoavaliacoes`} className="text-slate-500 transition hover:text-slate-900">
          ← Autoavaliações
        </Link>
      </div>
      <AutoavaliacaoEditor
        companyId={id}
        cargos={cargos}
        modelo={{ id: modelo.id, nome: modelo.nome, cargoId: modelo.cargoId ?? "", instrucoes: modelo.instrucoes ?? "" }}
        perguntas={perguntas}
      />
    </main>
  );
}
