import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate, paraCampoDeData } from "@/lib/dates";
import { lerDados, lerStatus } from "@/lib/mapeamento";
import { modeloSugerido } from "@/lib/autoavaliacao";
import MapeamentoEditor from "@/components/mapeamento-editor";
import MapeamentoItens from "@/components/mapeamento-itens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapeamento de rotinas — RH Resultados" };

/** Um mapeamento de rotinas: a entrevista nas seções do modelo e a passagem para a autoavaliação. */
export default async function MapeamentoPage({
  params,
}: {
  params: Promise<{ id: string; pessoaId: string; mapId: string }>;
}) {
  await requireSession();
  const { id, pessoaId, mapId } = await params;

  const [m, modelos] = await Promise.all([
    prisma.mapeamentoDeRotina.findFirst({
      where: { id: mapId, employeeId: pessoaId, companyId: id },
      include: { employee: { select: { name: true, role: true, cargoId: true, phone: true } } },
    }),
    prisma.modeloDeAutoavaliacao.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, cargoId: true, perguntas: { select: { texto: true } } },
    }),
  ]);
  if (!m) notFound();
  const dados = lerDados(m.dados);
  const sugerido = modeloSugerido(modelos, m.employee) ?? modeloSugerido(modelos, { cargoId: null, role: dados.cargo });

  return (
    <main className="space-y-3.5">
      <Link href={`/empresas/${id}/equipe/${pessoaId}`} className="text-sm text-slate-500 transition hover:text-slate-900">
        ← Voltar para {m.employee.name}
      </Link>
      <MapeamentoEditor
        companyId={id}
        employeeId={pessoaId}
        mapId={m.id}
        pessoa={m.employee.name}
        cabecalho={{
          dataDaEntrevista: paraCampoDeData(m.dataDaEntrevista),
          entrevistador: m.entrevistador ?? "",
          versao: m.versao,
          proximaRevisao: paraCampoDeData(m.proximaRevisao),
        }}
        dados={dados}
        link={{
          status: lerStatus(m.status),
          token: m.token,
          telefone: m.employee.phone,
          respondidoEm: m.respondidoEm ? formatFullDate(m.respondidoEm) : null,
        }}
      />
      <MapeamentoItens
        companyId={id}
        mapId={m.id}
        modelos={modelos.map((x) => ({ id: x.id, nome: x.nome, textos: x.perguntas.map((p) => p.texto) }))}
        sugerido={sugerido?.id ?? null}
        funcao={dados.cargo || m.employee.role || ""}
      />
    </main>
  );
}
