"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { cargoDoCadastro, gerarIntegracaoDe } from "@/lib/treinamentos-dados";
import { gerarLinkDaFuncao } from "@/lib/autoavaliacao-envio";

export type EquipeState = {
  error?: string;
  ok?: boolean;
  /** O link da autoavaliação que nasceu com o cadastro, para mandar na hora. */
  autoavaliacao?: { token: string; titulo: string; nome: string; telefone: string | null };
};

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
}

const log = atividade("COLABORADOR");

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(`${v}T00:00:00.000Z`)))
  .nullable()
  .optional()
  .refine((v) => v == null || !Number.isNaN(v.getTime()), {
    message: "Data inválida.",
  });

// ------------------------------------------------------------ Colaborador

const employeeSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome do colaborador."),
  document: opt,
  cargoId: opt,
  novoCargo: opt,
  department: opt,
  email: opt,
  phone: opt,
  branchId: opt,
  birthDate: optDate,
  hiredAt: optDate,
  terminatedAt: optDate,
  status: z.enum(["ATIVO", "AFASTADO", "DESLIGADO"]).default("ATIVO"),
  notes: opt,
});

export async function saveEmployee(
  _prev: EquipeState,
  formData: FormData,
): Promise<EquipeState> {
  const session = await requireSession();

  const parsed = employeeSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId") ?? undefined,
    name: formData.get("name"),
    document: formData.get("document"),
    cargoId: formData.get("cargoId"),
    novoCargo: formData.get("novoCargo"),
    department: formData.get("department"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    branchId: formData.get("branchId"),
    birthDate: formData.get("birthDate"),
    hiredAt: formData.get("hiredAt"),
    terminatedAt: formData.get("terminatedAt"),
    status: formData.get("status") || "ATIVO",
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { companyId, employeeId, cargoId, novoCargo, ...resto } = parsed.data;

  // A unidade tem de ser desta empresa: senão a pessoa apareceria na filial
  // de outro cliente.
  if (resto.branchId) {
    const daEmpresa = await prisma.branch.count({ where: { id: resto.branchId, companyId } });
    if (!daEmpresa) return { error: "Essa unidade não é desta empresa." };
  }
  if (!(await prisma.company.count({ where: { id: companyId } }))) {
    return { error: "Empresa não encontrada." };
  }

  // O cargo vem da lista da empresa (ou entra nela, se é novo). O texto em
  // role acompanha, para quem ainda lê o cargo por ele.
  const cargo = await cargoDoCadastro(companyId, cargoId ?? null, novoCargo ?? null);
  const dados = { ...resto, cargoId: cargo?.id ?? null, role: cargo?.nome ?? null };

  let pessoaId: string;
  if (employeeId) {
    // Só atualiza quem é desta empresa.
    const { count } = await prisma.employee.updateMany({ where: { id: employeeId, companyId }, data: dados });
    if (count === 0) return { error: "Colaborador não encontrado nesta empresa." };
    pessoaId = employeeId;
    await log(
      companyId,
      session.userId,
      "ATUALIZOU",
      employeeId,
      `Atualizou o cadastro de ${dados.name}.`,
    );
  } else {
    const criado = await prisma.employee.create({
      data: { ...dados, companyId },
      select: { id: true },
    });
    // Toda pessoa nova na equipe já nasce com o checklist de integração.
    await gerarIntegracaoDe(criado.id, companyId);
    pessoaId = criado.id;
    await log(
      companyId,
      session.userId,
      "CRIOU",
      criado.id,
      `Cadastrou o colaborador ${dados.name}.`,
    );
  }

  // Com a função preenchida e o modelo dela pronto, a autoavaliação do PDI já
  // sai com o cadastro (só para quem ainda não tem link nenhum).
  let autoavaliacao: EquipeState["autoavaliacao"];
  if (dados.status !== "DESLIGADO" && dados.cargoId) {
    const link = await gerarLinkDaFuncao(pessoaId, session.userId);
    if (link) {
      autoavaliacao = { ...link, nome: dados.name, telefone: dados.phone ?? null };
      await log(companyId, session.userId, "CRIOU", pessoaId, `Gerou o link da autoavaliação (${link.titulo}) de ${dados.name}.`);
    }
  }

  refresh(companyId);
  return { ok: true, autoavaliacao };
}

export async function deleteEmployee(employeeId: string) {
  const session = await requireSession();

  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      companyId: true,
      name: true,
      _count: { select: { records: true, plans: true } },
    },
  });
  if (!pessoa) return;

  await prisma.employee.delete({ where: { id: employeeId } });

  await log(
    pessoa.companyId,
    session.userId,
    "EXCLUIU",
    employeeId,
    `Excluiu ${pessoa.name}, com ${pessoa._count.records} registro(s) e ${pessoa._count.plans} PDI(s).`,
  );

  refresh(pessoa.companyId);
}

// ------------------------------------------------- Registros da linha do tempo

const recordSchema = z.object({
  employeeId: z.string().min(1),
  kind: z.enum(["OBSERVACAO", "ADVERTENCIA", "FALTA", "ATESTADO"]),
  date: z.string().min(10, "Informe a data."),
  endDate: opt,
  description: z.string().trim().min(3, "Descreva o registro."),
  severity: z.enum(["VERBAL", "ESCRITA", "SUSPENSAO"]).optional(),
  justified: z.string().optional(),
});

export async function addRecord(
  _prev: EquipeState,
  formData: FormData,
): Promise<EquipeState> {
  const session = await requireSession();

  const parsed = recordSchema.safeParse({
    employeeId: formData.get("employeeId"),
    kind: formData.get("kind"),
    date: formData.get("date"),
    endDate: formData.get("endDate"),
    description: formData.get("description"),
    severity: formData.get("severity") || undefined,
    justified: formData.get("justified") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const pessoa = await prisma.employee.findUnique({
    where: { id: d.employeeId },
    select: { companyId: true, name: true },
  });
  if (!pessoa) return { error: "Colaborador não encontrado." };

  const data = new Date(`${d.date}T00:00:00.000Z`);
  if (Number.isNaN(data.getTime())) return { error: "Data inválida." };

  const fim = d.endDate ? new Date(`${d.endDate}T00:00:00.000Z`) : null;
  if (fim && fim < data) {
    return { error: "O fim do período não pode ser antes do início." };
  }

  await prisma.employeeRecord.create({
    data: {
      employeeId: d.employeeId,
      kind: d.kind,
      date: data,
      endDate: fim,
      description: d.description,
      // Campos que só valem para um tipo: os demais ficam nulos.
      severity: d.kind === "ADVERTENCIA" ? (d.severity ?? "VERBAL") : null,
      justified: d.kind === "FALTA" ? d.justified === "on" : null,
      createdById: session.userId,
    },
  });

  const rotulo: Record<string, string> = {
    OBSERVACAO: "uma observação",
    ADVERTENCIA: "uma advertência",
    FALTA: "uma falta",
    ATESTADO: "um atestado",
  };

  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    d.employeeId,
    `Registrou ${rotulo[d.kind]} para ${pessoa.name}.`,
  );

  refresh(pessoa.companyId);
  return { ok: true };
}

export async function deleteRecord(recordId: string) {
  const session = await requireSession();

  const registro = await prisma.employeeRecord.findUnique({
    where: { id: recordId },
    include: { employee: { select: { companyId: true, name: true } } },
  });
  if (!registro) return;

  await prisma.employeeRecord.delete({ where: { id: recordId } });

  await log(
    registro.employee.companyId,
    session.userId,
    "EXCLUIU",
    registro.employeeId,
    `Excluiu um registro de ${registro.employee.name}.`,
  );

  refresh(registro.employee.companyId);
}
