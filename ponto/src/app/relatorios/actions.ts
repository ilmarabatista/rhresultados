"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";

/** O colaborador confirma que conferiu o relatório do mês. */
export async function darCiencia(mes: string) {
  const s = await exigirColaborador();
  await prisma.relatorio.updateMany({ where: { colaboradorId: s.id, mes, cienteEm: null }, data: { cienteEm: new Date() } });
  revalidatePath("/relatorios");
  revalidatePath(`/relatorios/${mes}`);
}
