import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import DeleteCompany from "@/components/delete-company";
import BranchesManager from "@/components/branches-manager";
import CompanyForm from "@/components/company-form";
import { updateCompany } from "../../actions";
import {
  dateToDayKey,
  dayKeyToDate,
  formatFullDate,
  todayKey,
} from "@/lib/dates";
import { faixaHoraria } from "@/lib/agenda";
import BriefingCard from "@/components/briefing-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dados — RH Resultados" };

function paraInput(date: Date | null) {
  return date ? dateToDayKey(date) : "";
}

export default async function InformacoesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  // As duas leituras não dependem uma da outra: vão juntas.
  const [company, proximas] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        branches: { orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }] },
        createdBy: { select: { name: true } },
        _count: {
          select: {
            meetings: true,
            planos: true,
            employees: true,
            visits: true,
            jobOpenings: true,
            branches: true,
            activities: true,
          },
        },
      },
    }),
    // Agenda desta empresa, de hoje em diante.
    prisma.visit.findMany({
      where: {
        companyId: id,
        status: "AGENDADA",
        date: { gte: dayKeyToDate(todayKey()) },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 5,
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        subject: true,
        location: true,
        service: { select: { name: true } },
      },
    }),
  ]);

  if (!company) notFound();

  const agendaDaEmpresa = `/empresas/${id}/agenda`;

  return (
    <main className="space-y-3.5">
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Planos de treinamento", valor: company._count.planos },
          { label: "Reuniões", valor: company._count.meetings },
          { label: "Pessoas na equipe", valor: company._count.employees },
          { label: "Unidades", valor: company._count.branches },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-0.5 text-xl font-semibold text-slate-900">
              {card.valor}
            </p>
          </div>
        ))}
      </div>

      <BriefingCard
        companyId={company.id}
        briefing={company.briefing}
        registradoEm={
          company.briefingAt ? formatFullDate(company.briefingAt) : null
        }
      />

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Próximos agendamentos
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Quando você estará neste cliente e o que vai trabalhar.
            </p>
          </div>
          <Link
            href={agendaDaEmpresa}
            className="shrink-0 text-xs text-brand-700 transition hover:text-brand-800"
          >
            abrir a agenda
          </Link>
        </div>

        {proximas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nada agendado com este cliente.{" "}
            <Link href={agendaDaEmpresa} className="text-brand-700 hover:underline">
              Agendar
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {proximas.map((v) => (
              <li key={v.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="w-36 shrink-0 text-xs text-slate-400">
                  {formatFullDate(v.date)} · {faixaHoraria(v.startTime, v.endTime)}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-700">
                  {v.subject ?? v.service?.name ?? "sem assunto definido"}
                </span>
                {v.location ? (
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {v.location}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <BranchesManager
        companyId={company.id}
        unidades={company.branches.map((b) => ({
          id: b.id,
          name: b.name,
          isHeadquarters: b.isHeadquarters,
          street: b.street,
          number: b.number,
          complement: b.complement,
          district: b.district,
          city: b.city,
          state: b.state,
          zipCode: b.zipCode,
          employeeCount: b.employeeCount,
          phone: b.phone,
        }))}
      />

      <div className="mb-5">
        <h2 className="text-base font-semibold text-slate-900">
          Dados cadastrais
        </h2>
        <p className="text-sm text-slate-500">
          Cadastrada por {company.createdBy?.name ?? "—"} em{" "}
          {formatFullDate(company.createdAt)}.
        </p>
      </div>

      <CompanyForm
        action={updateCompany}
        submitLabel="Salvar alterações"
        withBranches={false}
        defaults={{
          id: company.id,
          name: company.name,
          legalName: company.legalName,
          cnpj: company.cnpj,
          industry: company.industry,
          tone: company.tone,
          employeeCount: company.employeeCount,
          website: company.website,
          description: company.description,
          contactName: company.contactName,
          contactEmail: company.contactEmail,
          contactPhone: company.contactPhone,
          contractService: company.contractService,
          contractValue: company.contractValue
            ? company.contractValue.toString()
            : "",
          contractDate: paraInput(company.contractDate),
          contractEndDate: paraInput(company.contractEndDate),
          contractStatus: company.contractStatus,
          paymentDay: company.paymentDay,
          notes: company.notes,
        }}
      />

      {/* Excluir cliente é ação de administrador. */}
      {session.role === "ADMIN" ? (
        <DeleteCompany
          companyId={company.id}
          companyName={company.name}
          impacto={{
            reunioes: company._count.meetings,
            planos: company._count.planos,
            pessoas: company._count.employees,
            compromissos: company._count.visits,
            vagas: company._count.jobOpenings,
            filiais: company._count.branches,
            atividades: company._count.activities,
          }}
        />
      ) : null}
    </main>
  );
}
