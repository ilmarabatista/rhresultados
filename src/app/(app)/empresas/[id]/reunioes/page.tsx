import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, formatFullDate, todayKey } from "@/lib/dates";
import { codigoDaReuniao, lerSituacao } from "@/lib/reunioes";
import { opcoesDaReuniao } from "@/lib/reunioes-dados";
import MeetingsList, { type ReuniaoDaLista } from "@/components/meetings-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reuniões — RH Resultados" };

/**
 * Todas as reuniões da empresa num lugar: as criadas à mão e as dos planos de
 * treinamento. O produto é o escolhido na reunião ou, sem escolha, o do plano.
 */
export default async function ReunioesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nova?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const { nova } = await searchParams;

  const [reunioes, opcoes] = await Promise.all([
    prisma.meeting.findMany({
      // A em preparação num plano só entra aqui quando for mandada para reunião.
      where: { companyId: id, status: { not: "PLANEJADA" } },
      select: {
        id: true,
        number: true,
        title: true,
        date: true,
        startTime: true,
        status: true,
        serviceId: true,
        department: true,
        branchId: true,
        kind: true,
        location: true,
        plano: { select: { titulo: true, serviceId: true } },
        _count: { select: { participants: true } },
        items: {
          where: { kind: "COMBINADO", done: false },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          select: { text: true, responsible: true, dueDate: true },
        },
      },
    }),
    opcoesDaReuniao(id),
  ]);

  const nomeDaUnidade = new Map(opcoes.unidades.map((u) => [u.id, u.nome]));
  const nomeDoProduto = new Map(opcoes.produtos.map((p) => [p.id, p.nome]));
  const produtoDe = (pid: string | null | undefined) => (pid && nomeDoProduto.get(pid)) || null;

  const lista: ReuniaoDaLista[] = reunioes.map((r) => ({
    id: r.id,
    href: `/empresas/${id}/reunioes/${r.id}`,
    reuniaoId: r.id,
    numero: r.number,
    codigo: codigoDaReuniao(r.number),
    plano: r.plano?.titulo ?? null,
    produto: produtoDe(r.serviceId ?? r.plano?.serviceId),
    titulo: r.title,
    dia: r.date ? formatFullDate(r.date) : null,
    chave: r.date ? dateToDayKey(r.date) : null,
    hora: r.startTime,
    situacao: lerSituacao(r.status),
    setor: r.department,
    unidade: (r.branchId && nomeDaUnidade.get(r.branchId)) || "Rede",
    tipo: r.kind,
    local: r.location,
    participantes: r._count.participants,
    combinadosAbertos: r.items.length,
    combinados: r.items.map((i) => ({
      texto: i.text,
      responsavel: i.responsible,
      prazo: i.dueDate ? formatFullDate(i.dueDate) : null,
    })),
  }));

  return (
    <MeetingsList
      companyId={id}
      hoje={todayKey()}
      abrirNova={nova === "1"}
      opcoes={opcoes}
      reunioes={lista}
    />
  );
}
