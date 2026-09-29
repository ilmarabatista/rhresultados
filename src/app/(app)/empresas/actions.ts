"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireSession } from "@/lib/session";
import { lerValor } from "@/lib/gestao";

export type FormState = { error?: string; ok?: boolean };

/** "" → undefined; mantém o resto trimado. */
const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const optInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v)))
  .optional()
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
    message: "Número inválido.",
  });

/**
 * Valor em reais, digitado à brasileira.
 *
 * A leitura é a mesma do painel de despesas. A cópia que havia aqui apagava
 * todo ponto, e "1234.56" virava R$ 123.456,00.
 */
const optDecimal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : lerValor(v)))
  .optional()
  .refine((v) => v !== null, { message: "Valor inválido. Use 1.234,56." })
  .transform((v) => (v == null ? undefined : v / 100));

const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : new Date(`${v}T00:00:00.000Z`)))
  .optional()
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), {
    message: "Data inválida.",
  });

const companySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  legalName: opt,
  cnpj: opt,
  industry: opt,
  tone: opt,
  employeeCount: optInt,
  website: opt,
  description: opt,
  contactName: opt,
  contactEmail: opt,
  contactPhone: opt,
  contractService: opt,
  contractValue: optDecimal,
  contractDate: optDate,
  contractEndDate: optDate,
  contractStatus: z
    .enum(["PROSPECTO", "ATIVO", "PAUSADO", "ENCERRADO"])
    .default("ATIVO"),
  paymentDay: optInt,
  notes: opt,
});

const branchSchema = z.object({
  name: z.string().trim().min(1),
  isHeadquarters: z.boolean(),
  street: opt,
  number: opt,
  complement: opt,
  district: opt,
  city: opt,
  state: opt,
  zipCode: opt,
  employeeCount: optInt,
  phone: opt,
});

/** Lê as filiais enviadas como filiais[i][campo]. */
function parseBranches(formData: FormData) {
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = key.match(/^filiais\[(\d+)]/);
    if (m) indices.add(Number(m[1]));
  }

  const matrizIndex = String(formData.get("matrizIndex") ?? "0");

  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => {
      const get = (campo: string) =>
        String(formData.get(`filiais[${i}][${campo}]`) ?? "");
      return branchSchema.safeParse({
        name: get("name") || (String(i) === matrizIndex ? "Matriz" : `Filial ${i + 1}`),
        isHeadquarters: String(i) === matrizIndex,
        street: get("street"),
        number: get("number"),
        complement: get("complement"),
        district: get("district"),
        city: get("city"),
        state: get("state"),
        zipCode: get("zipCode"),
        employeeCount: get("employeeCount"),
        phone: get("phone"),
      });
    })
    .filter((r) => r.success)
    .map((r) => r.data)
    // descarta unidades totalmente em branco
    .filter((b) => b.street || b.city || b.name);
}

function fields(formData: FormData) {
  return {
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    cnpj: formData.get("cnpj"),
    industry: formData.get("industry"),
    tone: formData.get("tone"),
    employeeCount: formData.get("employeeCount"),
    website: formData.get("website"),
    description: formData.get("description"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    contractService: formData.get("contractService"),
    contractValue: formData.get("contractValue"),
    contractDate: formData.get("contractDate"),
    contractEndDate: formData.get("contractEndDate"),
    contractStatus: formData.get("contractStatus") || "ATIVO",
    paymentDay: formData.get("paymentDay"),
    notes: formData.get("notes"),
  };
}

export async function createCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const parsed = companySchema.safeParse(fields(formData));

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const branches = parseBranches(formData);
  let companyId: string;

  try {
    const company = await prisma.company.create({
      data: {
        ...parsed.data,
        createdById: session.userId,
        branches: branches.length ? { create: branches } : undefined,
      },
      select: { id: true, name: true },
    });
    companyId = company.id;

    await prisma.activity.create({
      data: {
        companyId: company.id,
        userId: session.userId,
        action: "CRIOU",
        entityType: "EMPRESA",
        entityId: company.id,
        description: `Empresa ${company.name} cadastrada.`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Já existe uma empresa cadastrada com esse CNPJ." };
    }
    return { error: "Não foi possível cadastrar a empresa. Tente novamente." };
  }

  // Direto para os dados: /empresas/[id] só redireciona, e passar por ele
  // era uma ida ao servidor a mais.
  revalidatePath("/empresas", "layout");
  redirect(`/empresas/${companyId}/dados`);
}

export async function updateCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const id = String(formData.get("companyId") ?? "");
  if (!id) return { error: "Empresa não identificada." };

  const parsed = companySchema.safeParse(fields(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await prisma.company.update({ where: { id }, data: parsed.data });
    // Sem esta linha, o cadastro salvo não aparecia no cabeçalho nem na lista.
    revalidatePath(`/empresas/${id}`, "layout");
    await prisma.activity.create({
      data: {
        companyId: id,
        userId: session.userId,
        action: "ATUALIZOU",
        entityType: "EMPRESA",
        entityId: id,
        description: "Informações cadastrais atualizadas.",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return { error: "Já existe outra empresa cadastrada com esse CNPJ." };
    }
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath(`/empresas/${id}/dados`);
  return { ok: true };
}

/**
 * Exclui a empresa e tudo que depende dela.
 *
 * É irreversível: filiais, planejamentos, tarefas, subtarefas, serviços do
 * escopo, metas, projetos e o fluxo de atividades caem por cascade. Por isso
 * exige perfil ADMIN e que o nome da empresa seja digitado por extenso.
 */
export async function deleteCompany(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const id = String(formData.get("companyId") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "").trim();
  if (!id) return { error: "Empresa não identificada." };

  const company = await prisma.company.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!company) return { error: "Empresa não encontrada." };

  if (confirmacao !== company.name) {
    return {
      error: `Digite exatamente "${company.name}" para confirmar a exclusão.`,
    };
  }

  try {
    await prisma.company.delete({ where: { id } });
  } catch {
    return { error: "Não foi possível excluir a empresa." };
  }

  revalidatePath("/empresas");
  redirect("/empresas");
}

// ----------------------------------------------------------- Filiais

const branchFormSchema = z.object({
  companyId: z.string().min(1),
  /** Vazio cria uma unidade nova. */
  branchId: z.string().optional(),
  name: z.string().trim().min(1, "Informe o nome da unidade."),
  street: opt,
  number: opt,
  complement: opt,
  district: opt,
  city: opt,
  state: opt,
  zipCode: opt,
  employeeCount: optInt,
  phone: opt,
});

/** Cria ou atualiza uma unidade da empresa. */
export async function saveBranch(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const parsed = branchFormSchema.safeParse({
    companyId: formData.get("companyId"),
    branchId: formData.get("branchId") ?? undefined,
    name: formData.get("name"),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement"),
    district: formData.get("district"),
    city: formData.get("city"),
    state: formData.get("state"),
    zipCode: formData.get("zipCode"),
    employeeCount: formData.get("employeeCount"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { companyId, branchId, ...dados } = parsed.data;

  if (branchId) {
    // Só a unidade desta empresa: o id vem da tela, e não pode mexer na de outro cliente.
    const { count } = await prisma.branch.updateMany({ where: { id: branchId, companyId }, data: dados });
    if (count === 0) return { error: "Unidade não encontrada nesta empresa." };
  } else {
    if (!(await prisma.company.count({ where: { id: companyId } }))) {
      return { error: "Empresa não encontrada." };
    }
    // A primeira unidade cadastrada vira a matriz automaticamente.
    const existentes = await prisma.branch.count({ where: { companyId } });
    await prisma.branch.create({
      data: { ...dados, companyId, isHeadquarters: existentes === 0 },
    });
  }

  await prisma.activity.create({
    data: {
      companyId,
      userId: session.userId,
      action: branchId ? "ATUALIZOU" : "CRIOU",
      entityType: "UNIDADE",
      entityId: branchId ?? null,
      description: `${branchId ? "Atualizou" : "Cadastrou"} a unidade "${dados.name}".`,
    },
  });

  revalidatePath(`/empresas/${companyId}/dados`);
  return { ok: true };
}

export async function deleteBranch(branchId: string) {
  const session = await requireSession();

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { companyId: true, name: true, isHeadquarters: true },
  });
  if (!branch) return;

  await prisma.branch.delete({ where: { id: branchId } });

  // Sem matriz a empresa fica órfã: promove a unidade mais antiga.
  if (branch.isHeadquarters) {
    const proxima = await prisma.branch.findFirst({
      where: { companyId: branch.companyId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (proxima) {
      await prisma.branch.update({
        where: { id: proxima.id },
        data: { isHeadquarters: true },
      });
    }
  }

  await prisma.activity.create({
    data: {
      companyId: branch.companyId,
      userId: session.userId,
      action: "EXCLUIU",
      entityType: "UNIDADE",
      entityId: branchId,
      description: `Excluiu a unidade "${branch.name}".`,
    },
  });

  revalidatePath(`/empresas/${branch.companyId}/dados`);
}

/** Marca a unidade como matriz, desmarcando a anterior. */
export async function setHeadquarters(branchId: string) {
  await requireSession();

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { companyId: true },
  });
  if (!branch) return;

  await prisma.$transaction([
    prisma.branch.updateMany({
      where: { companyId: branch.companyId },
      data: { isHeadquarters: false },
    }),
    prisma.branch.update({
      where: { id: branchId },
      data: { isHeadquarters: true },
    }),
  ]);

  revalidatePath(`/empresas/${branch.companyId}/dados`);
}

/**
 * Grava o briefing da primeira reunião.
 *
 * Fica separado de updateCompany porque é digitado durante a conversa, com a
 * pessoa na frente: salvar aqui não deve depender de o formulário de cadastro
 * inteiro estar válido.
 */
export async function salvarBriefing(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await requireSession();

  const id = String(formData.get("companyId") ?? "");
  const texto = String(formData.get("briefing") ?? "").trim();

  const empresa = await prisma.company.findUnique({
    where: { id },
    select: { name: true, briefing: true },
  });
  if (!empresa) return { error: "Empresa não encontrada." };

  await prisma.company.update({
    where: { id },
    data: {
      briefing: texto || null,
      briefingAt: texto ? new Date() : null,
    },
  });

  await prisma.activity.create({
    data: {
      companyId: id,
      userId: session.userId,
      action: empresa.briefing ? "ATUALIZOU" : "CRIOU",
      entityType: "BRIEFING",
      entityId: id,
      description: empresa.briefing
        ? "Atualizou o briefing."
        : "Registrou o briefing da primeira reunião.",
    },
  });

  revalidatePath(`/empresas/${id}/dados`);
  return { ok: true };
}
