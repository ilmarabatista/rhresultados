import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate, todayKey, dateToDayKey } from "@/lib/dates";
import PdiAbas from "@/components/pdi-abas";
import AutoavaliacaoModelos from "@/components/autoavaliacao-modelos";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autoavaliações — RH Resultados" };

/**
 * Os modelos de autoavaliação da empresa, um por função, e todos os links já
 * mandados. O envio a cada pessoa é feito no PDI dela.
 */
export default async function AutoavaliacoesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const hoje = todayKey();

  const [modelos, cargos, enviadas] = await Promise.all([
    prisma.modeloDeAutoavaliacao.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        updatedAt: true,
        cargo: { select: { nome: true } },
        _count: { select: { perguntas: true, enviadas: true } },
      },
    }),
    prisma.cargo.findMany({ where: { companyId: id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.autoavaliacao.findMany({
      where: { employee: { companyId: id } },
      orderBy: { enviadoEm: "desc" },
      take: 200,
      select: {
        id: true,
        token: true,
        titulo: true,
        status: true,
        prazo: true,
        enviadoEm: true,
        respondidoEm: true,
        avaliacaoId: true,
        employee: { select: { id: true, name: true } },
      },
    }),
  ]);

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">PDI</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          A autoavaliação é o ponto de partida do PDI. Monte uma ficha para cada função, mande o link a cada pessoa pelo
          PDI dela e, com as respostas, monte a avaliação e o plano de 3 meses para apresentar na conversa 1 a 1.
        </p>
      </div>
      <PdiAbas companyId={id} atual="autoavaliacoes" />
      <AutoavaliacaoModelos
        companyId={id}
        cargos={cargos}
        modelos={modelos.map((m) => ({
          id: m.id,
          nome: m.nome,
          cargo: m.cargo?.nome ?? null,
          perguntas: m._count.perguntas,
          enviadas: m._count.enviadas,
          atualizado: formatFullDate(m.updatedAt),
        }))}
        enviadas={enviadas.map((e) => ({
          id: e.id,
          token: e.token,
          titulo: e.titulo,
          status: e.status,
          pessoa: e.employee.name,
          pessoaId: e.employee.id,
          enviadoEm: formatFullDate(e.enviadoEm),
          respondidoEm: e.respondidoEm ? formatFullDate(e.respondidoEm) : null,
          prazo: e.prazo ? formatFullDate(e.prazo) : null,
          atrasado: e.status === "ENVIADO" && e.prazo != null && dateToDayKey(e.prazo) < hoje,
          montada: Boolean(e.avaliacaoId),
        }))}
      />
    </main>
  );
}
