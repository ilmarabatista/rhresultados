"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { anoValido, lerValor, LINHAS_SUGERIDAS } from "@/lib/gestao";

export type GestaoState = { error?: string; ok?: boolean };

function refresh() {
  revalidatePath("/gestao");
}

/** Cria as linhas sugeridas, só quando o plano de contas está vazio. */
export async function usarLinhasSugeridas(): Promise<GestaoState> {
  await requireSession();

  const quantas = await prisma.expenseLine.count();
  if (quantas > 0) {
    return { error: "O plano de contas já tem linhas." };
  }

  await prisma.expenseLine.createMany({
    data: LINHAS_SUGERIDAS.map((l, i) => ({
      name: l.name,
      group: l.group,
      notes: l.notes ?? null,
      order: i,
    })),
  });

  refresh();
  return { ok: true };
}

const linhaSchema = z.object({
  name: z.string().trim().min(2, "Escreva o nome da linha."),
  group: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function criarLinha(
  _prev: GestaoState,
  formData: FormData,
): Promise<GestaoState> {
  await requireSession();

  const parsed = linhaSchema.safeParse({
    name: formData.get("name"),
    group: formData.get("group") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ultima = await prisma.expenseLine.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.expenseLine.create({
    data: {
      name: parsed.data.name,
      group: parsed.data.group || null,
      notes: parsed.data.notes || null,
      order: (ultima?.order ?? -1) + 1,
    },
  });

  refresh();
  return { ok: true };
}

export async function renomearLinha(id: string, nome: string) {
  await requireSession();
  const limpo = nome.trim();
  if (limpo.length < 2) return;

  await prisma.expenseLine.update({ where: { id }, data: { name: limpo } });
  refresh();
}

/** Sobe ou desce a linha na tabela, trocando de lugar com a vizinha. */
export async function moverLinha(id: string, direcao: "cima" | "baixo") {
  await requireSession();

  const linhas = await prisma.expenseLine.findMany({
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  const i = linhas.findIndex((l) => l.id === id);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= linhas.length) return;

  await prisma.$transaction([
    prisma.expenseLine.update({
      where: { id: linhas[i].id },
      data: { order: linhas[j].order },
    }),
    prisma.expenseLine.update({
      where: { id: linhas[j].id },
      data: { order: linhas[i].order },
    }),
  ]);

  refresh();
}

/** Some da tabela sem perder o histórico. */
export async function arquivarLinha(id: string, ativa: boolean) {
  await requireSession();
  await prisma.expenseLine.update({ where: { id }, data: { active: ativa } });
  refresh();
}

/**
 * Excluir de vez só quando a linha nunca foi usada. Com lançamento, a saída é
 * arquivar: apagar levaria junto meses de histórico.
 */
export async function excluirLinha(id: string): Promise<GestaoState> {
  await requireSession();

  const lancamentos = await prisma.expenseEntry.count({ where: { lineId: id } });
  if (lancamentos > 0) {
    return {
      error: `Esta linha tem ${lancamentos} lançamento(s). Arquive em vez de excluir, para não perder o histórico.`,
    };
  }

  await prisma.expenseLine.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/**
 * Grava o valor de uma linha num mês.
 *
 * Texto vazio apaga o lançamento — é como se apaga uma célula de planilha.
 */
export async function lancarDespesa(
  lineId: string,
  ano: number,
  mes: number,
  bruto: string,
): Promise<GestaoState> {
  const session = await requireSession();

  if (!anoValido(ano) || mes < 1 || mes > 12) {
    return { error: "Mês inválido." };
  }

  const month = new Date(Date.UTC(ano, mes - 1, 1));
  const centavos = lerValor(bruto);

  if (centavos === null) {
    if (bruto.trim() !== "") {
      return { error: "Valor inválido. Use 1.234,56." };
    }
    await prisma.expenseEntry.deleteMany({ where: { lineId, month } });
    refresh();
    return { ok: true };
  }

  const valor = new Prisma.Decimal(centavos).dividedBy(100);

  await prisma.expenseEntry.upsert({
    where: { lineId_month: { lineId, month } },
    update: { amount: valor },
    create: { lineId, month, amount: valor, createdById: session.userId },
  });

  refresh();
  return { ok: true };
}
