import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { lerFuncionamento, segundaDaSemana, somarDias } from "@/lib/escala";
import { grupoDoCargo } from "@/lib/prestadores";
import { Aviso, Filtros, TituloDaSecao } from "@/components/ui";
import EscalaTela from "@/components/escala-tela";

export const dynamic = "force-dynamic";
export const metadata = { title: "Escala — RH Resultados" };

/**
 * A escala da equipe, semana a semana: quem trabalha em que turno, quem
 * folga, e se a loja fica coberta das 08h às 22h (ou no horário da empresa).
 */
export default async function EscalaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; unidade?: string; todos?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const semanaPedida = /^\d{4}-\d{2}-\d{2}$/.test(sp.semana ?? "") ? sp.semana! : todayKey();
  const segunda = segundaDaSemana(semanaPedida);
  const comPrestadores = sp.todos === "1";

  // Enquanto as tabelas da escala não existem no banco (migration por aplicar),
  // a aba avisa em vez de quebrar.
  const tabelasProntas = await prisma.turnoDaEscala
    .count({ where: { companyId: id } })
    .then(() => true)
    .catch((e: { code?: string }) => {
      if (e?.code === "P2021") return false;
      throw e;
    });
  if (!tabelasProntas) {
    return (
      <main className="space-y-3">
        <TituloDaSecao antes="Escala da" destaque="equipe" />
        <Aviso tom="informacao" rotulo="Quase pronto">
          A escala ainda não foi ligada no banco de dados. Assim que a atualização do banco for aplicada, esta aba
          passa a funcionar.
        </Aviso>
      </main>
    );
  }

  const [empresa, regras, turnos, unidades, pessoas] = await Promise.all([
    prisma.company.findUnique({ where: { id }, select: { name: true } }),
    prisma.regrasDaEscala.findUnique({ where: { companyId: id } }),
    prisma.turnoDaEscala.findMany({
      where: { companyId: id },
      orderBy: [{ ordem: "asc" }, { inicio: "asc" }],
      select: { id: true, nome: true, inicio: true, fim: true, intervalo: true, cor: true },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: { companyId: id, status: { not: "DESLIGADO" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true, status: true, branchId: true, branch: { select: { name: true } } },
    }),
  ]);
  if (!empresa) notFound();

  const unidade = unidades.some((u) => u.id === sp.unidade) ? sp.unidade! : null;
  const daUnidade = pessoas.filter((p) => !unidade || p.branchId === unidade);
  const prestadores = daUnidade.filter((p) => grupoDoCargo(p.role) != null).length;
  const lista = daUnidade.filter((p) => comPrestadores || grupoDoCargo(p.role) == null);

  // Duas semanas antes servem para os avisos de descanso, 7º dia e domingos.
  const dias = await prisma.diaDaEscala.findMany({
    where: {
      companyId: id,
      employeeId: { in: lista.map((p) => p.id) },
      data: { gte: dayKeyToDate(somarDias(segunda, -14)), lte: dayKeyToDate(somarDias(segunda, 6)) },
    },
    select: { employeeId: true, data: true, tipo: true, turnoId: true, inicio: true, fim: true, intervalo: true },
  });

  const link = (mudar: { unidade?: string | null; todos?: boolean }) => {
    const q = new URLSearchParams({ semana: segunda });
    const u = mudar.unidade !== undefined ? mudar.unidade : unidade;
    if (u) q.set("unidade", u);
    if (mudar.todos ?? comPrestadores) q.set("todos", "1");
    return `/empresas/${id}/escala?${q}`;
  };

  return (
    <main className="space-y-3">
      <TituloDaSecao antes="Escala da" destaque="equipe" />

      {unidades.length > 1 || prestadores > 0 ? (
        <div className="no-print flex flex-wrap items-center gap-x-4 gap-y-2">
          {unidades.length > 1 ? (
            <Filtros
              rotulo="Unidade"
              itens={[
                { rotulo: "Todas", href: link({ unidade: null }), ativo: !unidade, contagem: pessoas.length },
                ...unidades.map((u) => ({
                  rotulo: u.name,
                  href: link({ unidade: u.id }),
                  ativo: unidade === u.id,
                  contagem: pessoas.filter((p) => p.branchId === u.id).length,
                })),
              ]}
            />
          ) : null}
          {prestadores > 0 ? (
            <Filtros
              itens={[
                {
                  rotulo: comPrestadores ? "Com dentistas e laboratório" : "Mostrar dentistas e laboratório",
                  href: link({ todos: !comPrestadores }),
                  ativo: comPrestadores,
                  contagem: prestadores,
                },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      <EscalaTela
        companyId={id}
        empresa={empresa.name}
        unidade={unidade ? (unidades.find((u) => u.id === unidade)?.name ?? null) : null}
        segunda={segunda}
        hoje={todayKey()}
        funcionamento={lerFuncionamento(regras?.funcionamento)}
        temRegras={regras != null}
        minimo={regras?.minimo ?? 1}
        turnos={turnos}
        pessoas={lista.map((p) => ({
          id: p.id,
          nome: p.name,
          cargo: p.role,
          unidade: unidade ? null : (p.branch?.name ?? null),
          afastado: p.status === "AFASTADO",
        }))}
        dias={dias.map(({ data, ...d }) => ({ ...d, dia: dateToDayKey(data) }))}
      />
    </main>
  );
}
