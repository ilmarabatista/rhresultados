"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { linhasComoItens } from "@/lib/text";
import { gerarPlanoTecnico, type PlanoTecnico } from "@/lib/ai-tecnico";
import { atividade } from "@/lib/atividade";

export type EquipeState = { error?: string; ok?: boolean };

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
  role: opt,
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
    role: formData.get("role"),
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

  const { companyId, employeeId, ...dados } = parsed.data;

  // A unidade tem de ser desta empresa: senão a pessoa apareceria na filial
  // de outro cliente.
  if (dados.branchId) {
    const daEmpresa = await prisma.branch.count({ where: { id: dados.branchId, companyId } });
    if (!daEmpresa) return { error: "Essa unidade não é desta empresa." };
  }
  if (!(await prisma.company.count({ where: { id: companyId } }))) {
    return { error: "Empresa não encontrada." };
  }

  if (employeeId) {
    // Só atualiza quem é desta empresa.
    const { count } = await prisma.employee.updateMany({ where: { id: employeeId, companyId }, data: dados });
    if (count === 0) return { error: "Colaborador não encontrado nesta empresa." };
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
    await log(
      companyId,
      session.userId,
      "CRIOU",
      criado.id,
      `Cadastrou o colaborador ${dados.name}.`,
    );
  }

  refresh(companyId);
  return { ok: true };
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

// ------------------------------------------------------------------- PDI

const planSchema = z.object({
  employeeId: z.string().min(1),
  title: z.string().trim().min(2, "Dê um nome ao plano."),
  objective: opt,
  startDate: opt,
  endDate: opt,
  acoes: z.string().optional(),
});

export async function createPlan(
  _prev: EquipeState,
  formData: FormData,
): Promise<EquipeState> {
  const session = await requireSession();

  const parsed = planSchema.safeParse({
    employeeId: formData.get("employeeId"),
    title: formData.get("title"),
    objective: formData.get("objective"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    acoes: formData.get("acoes") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const acoes = linhasComoItens(d.acoes ?? "");
  if (acoes.length === 0) {
    return { error: "Informe ao menos uma ação, uma por linha." };
  }

  const pessoa = await prisma.employee.findUnique({
    where: { id: d.employeeId },
    select: { companyId: true, name: true },
  });
  if (!pessoa) return { error: "Colaborador não encontrado." };

  await prisma.developmentPlan.create({
    data: {
      employeeId: d.employeeId,
      title: d.title,
      objective: d.objective ?? null,
      startDate: d.startDate ? new Date(`${d.startDate}T00:00:00.000Z`) : null,
      endDate: d.endDate ? new Date(`${d.endDate}T00:00:00.000Z`) : null,
      actions: { create: acoes.map((title, order) => ({ title, order })) },
    },
  });

  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    d.employeeId,
    `Criou o PDI "${d.title}" para ${pessoa.name}, com ${acoes.length} ação(ões).`,
  );

  refresh(pessoa.companyId);
  return { ok: true };
}

export async function togglePlanAction(actionId: string, done: boolean) {
  const session = await requireSession();

  const acao = await prisma.developmentAction.update({
    where: { id: actionId },
    data: { done, completedAt: done ? new Date() : null },
    select: {
      planId: true,
      plan: {
        select: {
          employee: { select: { companyId: true, name: true, id: true } },
        },
      },
    },
  });

  // O plano fecha sozinho quando todas as ações são cumpridas.
  const pendentes = await prisma.developmentAction.count({
    where: { planId: acao.planId, done: false },
  });
  await prisma.developmentPlan.update({
    where: { id: acao.planId },
    data: { status: pendentes === 0 ? "CONCLUIDO" : "EM_ANDAMENTO" },
  });

  const empresa = acao.plan.employee.companyId;
  await log(
    empresa,
    session.userId,
    done ? "CONCLUIU" : "REABRIU",
    acao.plan.employee.id,
    `${done ? "Cumpriu" : "Reabriu"} uma ação do PDI de ${acao.plan.employee.name}.`,
  );

  refresh(empresa);
}

export async function deletePlan(planId: string) {
  const session = await requireSession();

  const plano = await prisma.developmentPlan.findUnique({
    where: { id: planId },
    include: { employee: { select: { companyId: true, name: true, id: true } } },
  });
  if (!plano) return;

  await prisma.developmentPlan.delete({ where: { id: planId } });

  await log(
    plano.employee.companyId,
    session.userId,
    "EXCLUIU",
    plano.employee.id,
    `Excluiu o PDI "${plano.title}" de ${plano.employee.name}.`,
  );

  refresh(plano.employee.companyId);
}

// ---------------------------------------- Autoavaliação e plano técnico

const CAMPOS_AVALIACAO = [
  "roleTasks",
  "strengths",
  "difficulties",
  "toolsAndSystems",
  "blockers",
  "wantsToDevelop",
  "supportNeeded",
  "other",
] as const;

export type TecnicoState = {
  error?: string;
  plano?: PlanoTecnico;
  assessmentId?: string;
};

/**
 * O ponto de partida do plano montado à mão: cada linha do que a pessoa quer
 * desenvolver e de onde sente dificuldade vira uma ação, para ser revisada.
 */
function planoAMao(nome: string, respostas: Record<string, string | null>): PlanoTecnico {
  const linhas = [respostas.wantsToDevelop, respostas.difficulties]
    .flatMap((t) => linhasComoItens(t ?? ""))
    .slice(0, 12);
  return {
    leitura: "",
    titulo: `Desenvolvimento técnico — ${nome.split(/\s+/)[0]}`,
    objetivo: respostas.wantsToDevelop ?? respostas.difficulties ?? "",
    acoes: (linhas.length > 0 ? linhas : [""]).map((title) => ({ title, description: "" })),
  };
}

/**
 * Passo 1: grava a autoavaliação e monta a proposta de plano — à mão, a partir
 * das respostas, ou pedida à IA.
 *
 * A autoavaliação é gravada mesmo se a IA falhar — ela é a resposta da pessoa,
 * tem valor por si só e não deve se perder por um erro de rede. E o plano à mão
 * não depende de IA nenhuma.
 */
export async function gerarPlanoTecnicoAction(
  _prev: TecnicoState,
  formData: FormData,
): Promise<TecnicoState> {
  await requireSession();
  const aMao = formData.get("modo") !== "IA";

  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return { error: "Colaborador não identificado." };

  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, role: true, companyId: true },
  });
  if (!pessoa) return { error: "Colaborador não encontrado." };

  const respostas = Object.fromEntries(
    CAMPOS_AVALIACAO.map((c) => {
      const valor = String(formData.get(c) ?? "").trim();
      return [c, valor === "" ? null : valor];
    }),
  ) as Record<(typeof CAMPOS_AVALIACAO)[number], string | null>;

  const preenchidos = Object.values(respostas).filter(Boolean).length;
  if (preenchidos < 2) {
    return { error: "Responda ao menos duas perguntas da autoavaliação." };
  }

  const avaliacao = await prisma.skillAssessment.create({
    data: { employeeId, ...respostas },
    select: { id: true },
  });
  revalidatePath(`/empresas/${pessoa.companyId}/equipe/${employeeId}`);

  if (aMao) return { plano: planoAMao(pessoa.name, respostas), assessmentId: avaliacao.id };

  try {
    const plano = await gerarPlanoTecnico(pessoa.name, pessoa.role, respostas);
    return { plano, assessmentId: avaliacao.id };
  } catch (e) {
    return {
      error:
        (e instanceof Error ? e.message : "Não foi possível gerar o plano.") +
        " A autoavaliação foi gravada. Use \"Montar o plano à mão\" para seguir sem a IA.",
    };
  }
}

/** Passo 2: grava o plano revisado como um PDI da pessoa. */
export async function salvarPlanoTecnico(
  _prev: EquipeState,
  formData: FormData,
): Promise<EquipeState> {
  const session = await requireSession();

  const employeeId = String(formData.get("employeeId") ?? "");
  const assessmentId = String(formData.get("assessmentId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const bruto = String(formData.get("acoes") ?? "");

  if (!employeeId || !title) return { error: "Dados incompletos." };

  let lidas: unknown;
  try {
    lidas = JSON.parse(bruto);
  } catch {
    return { error: "Não foi possível ler as ações revisadas." };
  }
  const acoes = (Array.isArray(lidas) ? lidas : [])
    .map((a) => ({
      title: String(a?.title ?? "").trim(),
      description: String(a?.description ?? "").trim() || undefined,
    }))
    .filter((a) => a.title.length > 0);
  if (acoes.length === 0) {
    return { error: "Escreva ao menos uma ação no plano." };
  }

  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, name: true },
  });
  if (!pessoa) return { error: "Colaborador não encontrado." };
  // A autoavaliação tem de ser desta pessoa, e ainda sem plano.
  if (assessmentId) {
    const avaliacao = await prisma.skillAssessment.findFirst({
      where: { id: assessmentId, employeeId, plan: null },
      select: { id: true },
    });
    if (!avaliacao) return { error: "Esta autoavaliação já tem plano ou não é desta pessoa." };
  }

  await prisma.developmentPlan.create({
    data: {
      employeeId,
      assessmentId,
      title,
      objective: objective || null,
      actions: {
        create: acoes.map((a, order) => ({
          title: a.title,
          description: a.description ?? null,
          order,
        })),
      },
    },
  });

  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    employeeId,
    `Criou o plano técnico "${title}" para ${pessoa.name}${assessmentId ? ", a partir da autoavaliação" : ""}.`,
  );

  refresh(pessoa.companyId);
  return { ok: true };
}
