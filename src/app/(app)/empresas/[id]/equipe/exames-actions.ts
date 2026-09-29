"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { diaValido, horaValida } from "@/lib/agenda";
import { rotuloDoTipo, validadeDe } from "@/lib/exames";
import { dayKeyToDate, formatFullDate } from "@/lib/dates";
import { atividade } from "@/lib/atividade";

export type ExameState = { error?: string; ok?: boolean };

/** O exame vive dentro da ficha do colaborador, e aparece na tela Início. */
function refresh(companyId: string, employeeId?: string | null) {
  revalidatePath(`/empresas/${companyId}/equipe`);
  revalidatePath("/inicio");
  if (employeeId) {
    revalidatePath(`/empresas/${companyId}/equipe/${employeeId}`);
  }
}

const log = atividade("EXAME");

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const data = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || diaValido(v), "Data inválida.");

const criarSchema = z.object({
  companyId: z.string().min(1),
  employeeId: opcional,
  candidateName: opcional,
  jobTitle: opcional,
  kind: z.enum([
    "ADMISSIONAL",
    "PERIODICO",
    "RETORNO_AO_TRABALHO",
    "MUDANCA_DE_FUNCAO",
    "DEMISSIONAL",
  ]),
  dueDate: data,
  clinic: opcional,
  clinicPhone: opcional,
  notes: opcional,
});

function nomeDe(
  candidateName: string | null,
  colaborador: { name: string } | null,
): string {
  return colaborador?.name ?? candidateName ?? "sem nome";
}

/**
 * Confere que o colaborador escolhido é da mesma empresa. A tela já só oferece
 * os certos; isto é a checagem do lado do servidor.
 */
async function colaboradorDaEmpresa(employeeId: string | null, companyId: string) {
  if (!employeeId) return { ok: true as const, pessoa: null };
  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, name: true },
  });
  if (!pessoa || pessoa.companyId !== companyId) {
    return { ok: false as const, pessoa: null };
  }
  return { ok: true as const, pessoa };
}

export async function criarExame(
  _prev: ExameState,
  formData: FormData,
): Promise<ExameState> {
  const session = await requireSession();

  const parsed = criarSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId") ?? undefined,
    candidateName: formData.get("candidateName") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
    kind: formData.get("kind"),
    dueDate: formData.get("dueDate") ?? undefined,
    clinic: formData.get("clinic") ?? undefined,
    clinicPhone: formData.get("clinicPhone") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  // Sem colaborador vinculado, o nome de quem vai fazer o exame é obrigatório:
  // uma tarefa sem dizer de quem é não serve para nada.
  if (!d.employeeId && !d.candidateName) {
    return {
      error: "Escolha o colaborador ou escreva o nome de quem vai fazer o exame.",
    };
  }

  const { ok, pessoa } = await colaboradorDaEmpresa(d.employeeId, d.companyId);
  if (!ok) return { error: "Esse colaborador não é desta empresa." };

  const exame = await prisma.healthExam.create({
    data: {
      companyId: d.companyId,
      employeeId: d.employeeId,
      candidateName: d.employeeId ? null : d.candidateName,
      jobTitle: d.jobTitle,
      kind: d.kind,
      dueDate: d.dueDate ? dayKeyToDate(d.dueDate) : null,
      clinic: d.clinic,
      clinicPhone: d.clinicPhone,
      notes: d.notes,
      createdById: session.userId,
    },
    select: { id: true },
  });

  await log(
    d.companyId,
    session.userId,
    "CRIOU",
    exame.id,
    `Abriu a tarefa de exame ${rotuloDoTipo(d.kind).toLowerCase()} de ${nomeDe(
      d.candidateName,
      pessoa,
    )}.`,
  );

  refresh(d.companyId, d.employeeId);
  return { ok: true };
}

const agendarSchema = z.object({
  id: z.string().min(1),
  scheduledAt: z.string().trim().refine(diaValido, "Escolha o dia do exame."),
  scheduledTime: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || horaValida(v), "Hora inválida."),
  clinic: opcional,
  clinicPhone: opcional,
});

/** Marca o exame: é o que tira a tarefa de "a agendar". */
export async function agendarExame(
  _prev: ExameState,
  formData: FormData,
): Promise<ExameState> {
  const session = await requireSession();

  const parsed = agendarSchema.safeParse({
    id: formData.get("id"),
    scheduledAt: formData.get("scheduledAt"),
    scheduledTime: formData.get("scheduledTime") ?? undefined,
    clinic: formData.get("clinic") ?? undefined,
    clinicPhone: formData.get("clinicPhone") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  const exame = await prisma.healthExam.update({
    where: { id: d.id },
    data: {
      status: "AGENDADO",
      scheduledAt: dayKeyToDate(d.scheduledAt),
      scheduledTime: d.scheduledTime,
      clinic: d.clinic,
      clinicPhone: d.clinicPhone,
    },
    select: {
      companyId: true,
      employeeId: true,
      kind: true,
      candidateName: true,
      employee: { select: { name: true } },
    },
  });

  await log(
    exame.companyId,
    session.userId,
    "ATUALIZOU",
    d.id,
    `Agendou o exame ${rotuloDoTipo(exame.kind).toLowerCase()} de ${nomeDe(
      exame.candidateName,
      exame.employee,
    )} para ${formatFullDate(dayKeyToDate(d.scheduledAt))}${
      d.scheduledTime ? `, ${d.scheduledTime}` : ""
    }.`,
  );

  refresh(exame.companyId, exame.employeeId);
  return { ok: true };
}

const resultadoSchema = z.object({
  id: z.string().min(1),
  performedAt: z.string().trim().refine(diaValido, "Escolha o dia do exame."),
  result: z.enum(["APTO", "APTO_COM_RESTRICAO", "INAPTO"]),
  restrictions: opcional,
  validUntil: data,
  /// Meses de validade, quando a data não foi digitada à mão.
  meses: z.coerce.number().int().min(1).max(60).default(12),
});

/** Registra o resultado: é o que conclui a tarefa. */
export async function registrarResultado(
  _prev: ExameState,
  formData: FormData,
): Promise<ExameState> {
  const session = await requireSession();

  const parsed = resultadoSchema.safeParse({
    id: formData.get("id"),
    performedAt: formData.get("performedAt"),
    result: formData.get("result"),
    restrictions: formData.get("restrictions") ?? undefined,
    validUntil: formData.get("validUntil") ?? undefined,
    meses: formData.get("meses") || 12,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  if (d.result === "APTO_COM_RESTRICAO" && !d.restrictions) {
    return { error: "Descreva a restrição do ASO." };
  }

  // Demissional e inapto não geram próximo periódico: não há validade a contar.
  const validade =
    d.validUntil ?? (d.result === "INAPTO" ? null : validadeDe(d.performedAt, d.meses));

  const exame = await prisma.healthExam.update({
    where: { id: d.id },
    data: {
      status: "REALIZADO",
      performedAt: dayKeyToDate(d.performedAt),
      result: d.result,
      restrictions: d.restrictions,
      validUntil: validade ? dayKeyToDate(validade) : null,
    },
    select: {
      companyId: true,
      employeeId: true,
      kind: true,
      candidateName: true,
      employee: { select: { name: true } },
    },
  });

  await log(
    exame.companyId,
    session.userId,
    "CONCLUIU",
    d.id,
    `Registrou o exame ${rotuloDoTipo(exame.kind).toLowerCase()} de ${nomeDe(
      exame.candidateName,
      exame.employee,
    )}: ${d.result === "APTO" ? "apto" : d.result === "INAPTO" ? "inapto" : "apto com restrição"}.`,
  );

  refresh(exame.companyId, exame.employeeId);
  return { ok: true };
}

/** Volta a tarefa para "a agendar", quando o exame foi desmarcado. */
export async function reabrirExame(id: string) {
  const session = await requireSession();

  const exame = await prisma.healthExam.update({
    where: { id },
    data: {
      status: "A_AGENDAR",
      scheduledAt: null,
      scheduledTime: null,
      performedAt: null,
      result: null,
      restrictions: null,
      validUntil: null,
    },
    select: {
      companyId: true,
      employeeId: true,
      kind: true,
      candidateName: true,
      employee: { select: { name: true } },
    },
  });

  await log(
    exame.companyId,
    session.userId,
    "ATUALIZOU",
    id,
    `Reabriu a tarefa de exame ${rotuloDoTipo(exame.kind).toLowerCase()} de ${nomeDe(
      exame.candidateName,
      exame.employee,
    )}.`,
  );

  refresh(exame.companyId, exame.employeeId);
}

export async function cancelarExame(id: string) {
  const session = await requireSession();

  const exame = await prisma.healthExam.update({
    where: { id },
    data: { status: "CANCELADO" },
    select: {
      companyId: true,
      employeeId: true,
      kind: true,
      candidateName: true,
      employee: { select: { name: true } },
    },
  });

  await log(
    exame.companyId,
    session.userId,
    "ATUALIZOU",
    id,
    `Cancelou o exame ${rotuloDoTipo(exame.kind).toLowerCase()} de ${nomeDe(
      exame.candidateName,
      exame.employee,
    )}.`,
  );

  refresh(exame.companyId, exame.employeeId);
}

export async function excluirExame(id: string) {
  const session = await requireSession();

  const exame = await prisma.healthExam.findUnique({
    where: { id },
    select: {
      companyId: true,
      employeeId: true,
      kind: true,
      candidateName: true,
      employee: { select: { name: true } },
    },
  });
  if (!exame) return;

  await prisma.healthExam.delete({ where: { id } });

  await log(
    exame.companyId,
    session.userId,
    "EXCLUIU",
    id,
    `Excluiu o exame ${rotuloDoTipo(exame.kind).toLowerCase()} de ${nomeDe(
      exame.candidateName,
      exame.employee,
    )}.`,
  );

  refresh(exame.companyId, exame.employeeId);
}
