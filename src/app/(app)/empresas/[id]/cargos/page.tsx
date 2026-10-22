import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import { lerPerguntas } from "@/lib/entrevista";
import { lerTipoDeCompetencia } from "@/lib/pdi";
import { lerEspecificacao, lerNivelDeCargo, lerRespostas, lerResponsabilidades } from "@/lib/cargos";
import CargosTela, { type AbaDoCargo } from "@/components/cargos-tela";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cargos — RH Resultados" };

const ABAS: AbaDoCargo[] = ["descricao", "questionarios", "entrevista", "pessoas"];
/** Passou de um ano desde a aprovação: a descrição pede revisão. */
const UM_ANO = 365 * 24 * 60 * 60 * 1000;

/**
 * Os cargos da empresa: a descrição de cada um, o questionário de cargo que
 * quem ocupa o cargo responde, e o roteiro de entrevista que a vaga copia.
 */
export default async function CargosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cargo?: string; aba?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;
  const aba = ABAS.includes(sp.aba as AbaDoCargo) ? (sp.aba as AbaDoCargo) : "descricao";

  const [empresa, lista] = await Promise.all([
    prisma.company.findUnique({ where: { id }, select: { valores: true } }),
    prisma.cargo.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        nivel: true,
        missao: true,
        aprovadaEm: true,
        competencias: { orderBy: [{ ordem: "asc" }, { nome: "asc" }] },
        _count: {
          select: {
            colaboradores: { where: { status: { not: "DESLIGADO" } } },
            questionarios: { where: { status: "RESPONDIDO" } },
          },
        },
      },
    }),
  ]);

  const escolhidoId = lista.find((c) => c.id === sp.cargo)?.id ?? lista[0]?.id ?? null;
  const cargo = escolhidoId
    ? await prisma.cargo.findUnique({
        where: { id: escolhidoId },
        select: {
          id: true,
          setor: true,
          cbo: true,
          superior: true,
          subordinados: true,
          missao: true,
          responsabilidades: true,
          requisitos: true,
          especificacao: true,
          perguntasDaEntrevista: true,
          questionarios: { orderBy: { enviadoEm: "desc" } },
          colaboradores: {
            where: { status: { not: "DESLIGADO" } },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
          vagas: { orderBy: { openedAt: "desc" }, select: { id: true, title: true, status: true, openedAt: true } },
        },
      })
    : null;

  const agora = Date.now();

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Cargos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          Quem ocupa o cargo responde o questionário pelo link; a IA monta o rascunho da descrição e você revisa e aprova.
          A descrição dá a régua do PDI, e o roteiro de entrevista do cargo vai para cada vaga aberta para ele.
        </p>
      </div>

      <CargosTela
        companyId={id}
        aba={aba}
        temValores={Boolean(empresa?.valores?.trim())}
        cargos={lista.map((c) => ({
          id: c.id,
          nome: c.nome,
          nivel: lerNivelDeCargo(c.nivel),
          pessoas: c._count.colaboradores,
          respondidos: c._count.questionarios,
          situacao: c.aprovadaEm
            ? agora - c.aprovadaEm.getTime() > UM_ANO
              ? "REVISAR"
              : "APROVADA"
            : c.missao || c.competencias.length
              ? "RASCUNHO"
              : "VAZIA",
          aprovadaEm: c.aprovadaEm ? formatFullDate(c.aprovadaEm) : null,
          competencias: c.competencias.map((k) => ({
            id: k.id,
            nome: k.nome,
            tipo: lerTipoDeCompetencia(k.tipo),
            descricao: k.descricao ?? "",
            nivelEsperado: k.nivelEsperado,
          })),
        }))}
        detalhe={
          cargo
            ? {
                id: cargo.id,
                setor: cargo.setor ?? "",
                cbo: cargo.cbo ?? "",
                superior: cargo.superior ?? "",
                subordinados: cargo.subordinados ?? "",
                missao: cargo.missao ?? "",
                // Uma linha em branco entre elas, para ler cada responsabilidade como parágrafo.
                responsabilidades: lerResponsabilidades(cargo.responsabilidades).join("\n\n"),
                requisitos: cargo.requisitos ?? "",
                especificacao: lerEspecificacao(cargo.especificacao),
                perguntas: lerPerguntas(cargo.perguntasDaEntrevista),
                questionarios: cargo.questionarios.map((q) => {
                  const nivel = lerNivelDeCargo(q.nivel) ?? "TECNICO";
                  return {
                    id: q.id,
                    token: q.token,
                    pessoa: q.pessoa,
                    nivel,
                    status: q.status === "RESPONDIDO" ? ("RESPONDIDO" as const) : ("ENVIADO" as const),
                    enviadoEm: formatFullDate(q.enviadoEm),
                    prazo: q.prazo ? formatFullDate(q.prazo) : null,
                    atrasado: q.status !== "RESPONDIDO" && q.prazo !== null && q.prazo.getTime() + 24 * 60 * 60 * 1000 < agora,
                    respondidoEm: q.respondidoEm ? formatFullDate(q.respondidoEm) : null,
                    respostas: lerRespostas(nivel, q.respostas),
                  };
                }),
                colaboradores: cargo.colaboradores.map((p) => ({ id: p.id, nome: p.name })),
                vagas: cargo.vagas.map((v) => ({ id: v.id, titulo: v.title, status: v.status, aberta: formatFullDate(v.openedAt) })),
              }
            : null
        }
      />
    </main>
  );
}
