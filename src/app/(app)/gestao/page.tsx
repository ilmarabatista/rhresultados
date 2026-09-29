import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { anoValido, PAINEIS, type Painel } from "@/lib/gestao";
import { todayKey } from "@/lib/dates";
import ManagementPanel from "@/components/management-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gestão — RH Resultados" };

export default async function GestaoPage({
  searchParams,
}: {
  searchParams: Promise<{ painel?: string; ano?: string }>;
}) {
  await requireSession();
  const { painel, ano: anoParam } = await searchParams;

  const escolhido = PAINEIS.some((p) => p.valor === painel)
    ? (painel as Painel)
    : "comercial";
  const ano = anoValido(anoParam)
    ? Number(anoParam)
    : Number(todayKey().slice(0, 4));

  // Só a aba de despesas consulta o banco; as outras ainda não têm origem.
  const linhas =
    escolhido === "despesas" || escolhido === "gerenciamento"
      ? await prisma.expenseLine.findMany({
          orderBy: { order: "asc" },
          include: {
            entries: {
              where: {
                month: {
                  gte: new Date(Date.UTC(ano, 0, 1)),
                  lt: new Date(Date.UTC(ano + 1, 0, 1)),
                },
              },
              select: { month: true, amount: true },
            },
            _count: { select: { entries: true } },
          },
        })
      : [];

  const mapeadas = linhas.map((l) => {
    const valores: Record<number, number> = {};
    for (const e of l.entries) {
      // O valor trafega em centavos para a tela não lidar com decimal.
      valores[e.month.getUTCMonth() + 1] = Math.round(Number(e.amount) * 100);
    }
    return {
      id: l.id,
      nome: l.name,
      grupo: l.group,
      ativa: l.active,
      notas: l.notes,
      valores,
      temLancamento: l._count.entries > 0,
    };
  });

  const totalDoAno = mapeadas.reduce(
    (soma, l) => soma + Object.values(l.valores).reduce((s, v) => s + v, 0),
    0,
  );

  return (
    <ManagementPanel
      painel={escolhido}
      ano={ano}
      linhas={mapeadas}
      totalDoAno={totalDoAno}
    />
  );
}
