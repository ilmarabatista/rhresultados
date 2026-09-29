import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, todayKey } from "@/lib/dates";
import { andamentoDosEncontros, estadoDoEncontro } from "@/lib/planos";
import PlanosBoard, { type LocalNaTela } from "@/components/planos-board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Planejamento — RH Resultados" };

/**
 * Os planos de treinamento da empresa: o que foi prometido (produto,
 * objetivo, periodicidade, temas), onde (as filiais, cada uma com as suas
 * datas) e em que pé está cada encontro — só no plano, na agenda, em reunião
 * ou realizado.
 */
export default async function PlanejamentoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const hoje = todayKey();

  const [planos, produtos, filiais] = await Promise.all([
    prisma.planoDeTreinamento.findMany({
      where: { companyId: id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        service: { select: { id: true, name: true } },
        encontros: {
          orderBy: { ordem: "asc" },
          include: {
            branch: { select: { id: true, name: true } },
            visit: { select: { status: true } },
            meeting: { select: { id: true, status: true } },
          },
        },
      },
    }),
    prisma.service.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isHeadquarters: true },
    }),
  ]);

  return (
    <PlanosBoard
      companyId={id}
      hoje={hoje}
      produtos={produtos.map((p) => ({ id: p.id, nome: p.name, ativo: p.active }))}
      filiais={filiais.map((f) => ({ id: f.id, nome: f.isHeadquarters ? `${f.name} (matriz)` : f.name }))}
      planos={planos.map((p) => {
        // Um grupo por local, na ordem em que aparecem; sem filial é "Empresa toda".
        const locais = new Map<string, LocalNaTela>();
        for (const e of p.encontros) {
          const chave = e.branch?.id ?? "EMPRESA";
          const local = locais.get(chave) ?? { chave, nome: e.branch?.name ?? "Empresa toda", encontros: [] };
          local.encontros.push({
            id: e.id,
            tema: e.tema,
            dia: e.data ? dateToDayKey(e.data) : null,
            hora: e.hora,
            estado: estadoDoEncontro({ visita: e.visit, reuniao: e.meeting }),
            reuniaoId: e.meeting?.id ?? null,
          });
          locais.set(chave, local);
        }
        const todos = [...locais.values()].flatMap((l) => l.encontros);
        return {
          id: p.id,
          titulo: p.titulo,
          objetivo: p.objetivo,
          periodicidade: p.periodicidade,
          horario: p.horario,
          status: p.status,
          produto: p.service ? { id: p.service.id, nome: p.service.name } : null,
          andamento: andamentoDosEncontros(todos, hoje),
          locais: [...locais.values()],
        };
      })}
    />
  );
}
