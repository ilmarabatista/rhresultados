import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import EmployeesList from "@/components/employees-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe — RH Resultados" };

export default async function EquipeEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const [colaboradores, unidades] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: id },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        branch: { select: { name: true } },
        _count: { select: { plans: true } },
        records: { select: { kind: true } },
      },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="space-y-3.5">
      <EmployeesList
        companyId={id}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.name }))}
        colaboradores={colaboradores.map((c) => ({
          id: c.id,
          nome: c.name,
          cargo: c.role,
          setor: c.department,
          unidade: c.branch?.name ?? null,
          status: c.status,
          planos: c._count.plans,
          advertencias: c.records.filter((r) => r.kind === "ADVERTENCIA").length,
          faltas: c.records.filter((r) => r.kind === "FALTA").length,
          atestados: c.records.filter((r) => r.kind === "ATESTADO").length,
        }))}
      />
    </main>
  );
}
