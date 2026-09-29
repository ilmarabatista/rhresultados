import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, formatFullDate, todayKey } from "@/lib/dates";
import EmployeeDetail from "@/components/employee-detail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Colaborador — RH Resultados" };

function paraInput(d: Date | null) {
  return d ? dateToDayKey(d) : "";
}

export default async function ColaboradorPage({
  params,
}: {
  params: Promise<{ id: string; pessoaId: string }>;
}) {
  await requireSession();
  const { id, pessoaId } = await params;

  const [pessoa, unidades] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: pessoaId, companyId: id },
      include: {
        branch: { select: { name: true } },
        records: {
          orderBy: { date: "desc" },
          include: { createdBy: { select: { name: true } } },
        },
        plans: {
          orderBy: { createdAt: "desc" },
          include: { actions: { orderBy: { order: "asc" } } },
        },
        assessments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, plan: { select: { id: true } } },
        },
        exams: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.branch.findMany({
      where: { companyId: id },
      orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!pessoa) notFound();

  return (
    <main className="space-y-3.5">
      <Link
        href={`/empresas/${id}/equipe`}
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Voltar para a equipe
      </Link>

      <EmployeeDetail
        companyId={id}
        unidades={unidades.map((u) => ({ id: u.id, nome: u.name }))}
        pessoa={{
          id: pessoa.id,
          name: pessoa.name,
          document: pessoa.document,
          role: pessoa.role,
          department: pessoa.department,
          email: pessoa.email,
          phone: pessoa.phone,
          branchId: pessoa.branchId,
          unidade: pessoa.branch?.name ?? null,
          birthDate: paraInput(pessoa.birthDate),
          hiredAt: paraInput(pessoa.hiredAt),
          terminatedAt: paraInput(pessoa.terminatedAt),
          status: pessoa.status,
          notes: pessoa.notes,
          admissao: pessoa.hiredAt ? formatFullDate(pessoa.hiredAt) : null,
        }}
        registros={pessoa.records.map((r) => ({
          id: r.id,
          kind: r.kind,
          data: formatFullDate(r.date),
          fim: r.endDate ? formatFullDate(r.endDate) : null,
          dias:
            r.endDate && r.date
              ? Math.round(
                  (r.endDate.getTime() - r.date.getTime()) / 86_400_000,
                ) + 1
              : null,
          description: r.description,
          severity: r.severity,
          justified: r.justified,
          autor: r.createdBy?.name ?? null,
        }))}
        hoje={todayKey()}
        exames={pessoa.exams.map((e) => ({
          id: e.id,
          tipo: e.kind,
          status: e.status,
          prazo: e.dueDate ? dateToDayKey(e.dueDate) : null,
          agendadoEm: e.scheduledAt ? dateToDayKey(e.scheduledAt) : null,
          hora: e.scheduledTime,
          clinica: e.clinic,
          telefone: e.clinicPhone,
          realizadoEm: e.performedAt ? dateToDayKey(e.performedAt) : null,
          resultado: e.result,
          restricoes: e.restrictions,
          validoAte: e.validUntil ? dateToDayKey(e.validUntil) : null,
          observacoes: e.notes,
        }))}
        avaliacoes={pessoa.assessments.map((a) => ({
          id: a.id,
          data: formatFullDate(a.createdAt),
          temPlano: Boolean(a.plan),
        }))}
        planos={pessoa.plans.map((p) => ({
          id: p.id,
          titulo: p.title,
          objetivo: p.objective,
          status: p.status,
          inicio: p.startDate ? formatFullDate(p.startDate) : null,
          fim: p.endDate ? formatFullDate(p.endDate) : null,
          acoes: p.actions.map((a) => ({
            id: a.id,
            title: a.title,
            done: a.done,
          })),
        }))}
      />
    </main>
  );
}
