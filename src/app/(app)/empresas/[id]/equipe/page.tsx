import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import EmployeesList from "@/components/employees-list";
import { pendenciasDaEmpresa } from "@/lib/treinamentos-dados";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe — RH Resultados" };

export default async function EquipeEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [colaboradores, ocorrencias, unidades, cargos, { porPessoa }] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: id },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        status: true,
        branch: { select: { name: true } },
        _count: { select: { plans: true } },
        integracao: { select: { feito: true } },
      },
    }),
    // Só as contagens por pessoa e tipo, sem trazer cada ocorrência.
    prisma.employeeRecord.groupBy({
      by: ["employeeId", "kind"],
      where: { employee: { companyId: id }, kind: { in: ["ADVERTENCIA", "FALTA", "ATESTADO"] } },
      _count: { _all: true },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.cargo.findMany({ where: { companyId: id }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    pendenciasDaEmpresa(id),
  ]);

  const contagem = new Map(ocorrencias.map((o) => [`${o.employeeId}|${o.kind}`, o._count._all]));
  const quantas = (employeeId: string, kind: string) => contagem.get(`${employeeId}|${kind}`) ?? 0;

  return (
    <main className="space-y-3.5">
      <EmployeesList
        companyId={id}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.name }))}
        cargos={cargos}
        colaboradores={colaboradores.map((c) => ({
          id: c.id,
          nome: c.name,
          cargo: c.role,
          setor: c.department,
          unidade: c.branch?.name ?? null,
          status: c.status,
          planos: c._count.plans,
          advertencias: quantas(c.id, "ADVERTENCIA"),
          faltas: quantas(c.id, "FALTA"),
          atestados: quantas(c.id, "ATESTADO"),
          integracaoFeita: c.integracao.filter((e) => e.feito).length,
          integracaoTotal: c.integracao.length,
          treinamentosPendentes: porPessoa.get(c.id)?.length ?? 0,
        }))}
      />
    </main>
  );
}
