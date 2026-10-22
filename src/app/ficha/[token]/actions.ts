"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fichaParaGravar, lerFicha, problemasDaFicha } from "@/lib/ficha";

/**
 * A ficha respondida pelo link. Como no teste, não há sessão: o token é a
 * credencial e o link aceita uma resposta só.
 */

export type FichaState = { error?: string; ok?: boolean };

/** Um JSON maior que isto não é uma ficha preenchida por gente. */
const TETO = 120_000;

export async function responderFicha(_prev: FichaState, formData: FormData): Promise<FichaState> {
  const token = String(formData.get("token") ?? "");
  const bruto = String(formData.get("ficha") ?? "");
  if (!token) return { error: "Link inválido." };
  if (!bruto || bruto.length > TETO) return { error: "Não foi possível ler a ficha. Recarregue a página e tente de novo." };

  let cru: unknown;
  try {
    cru = JSON.parse(bruto);
  } catch {
    return { error: "Não foi possível ler a ficha. Recarregue a página e tente de novo." };
  }

  const ficha = lerFicha(cru);
  const problemas = problemasDaFicha(ficha);
  if (problemas.length > 0) return { error: problemas[0] };

  const c = await prisma.candidate.findUnique({
    where: { applicationToken: token },
    select: { id: true, companyId: true, jobOpeningId: true, email: true, phone: true, applicationAnsweredAt: true },
  });
  if (!c) return { error: "Link inválido." };
  if (c.applicationAnsweredAt) return { error: "Esta ficha já foi enviada." };

  const agora = new Date();
  // A condição na data impede duas respostas ao mesmo tempo no mesmo link.
  const { count } = await prisma.candidate.updateMany({
    where: { id: c.id, applicationAnsweredAt: null },
    data: {
      applicationAnswers: fichaParaGravar(ficha),
      applicationAnsweredAt: agora,
      // O contato que faltava no cadastro vem da ficha; o que já havia fica.
      ...(c.email ? {} : ficha.pessoal.email ? { email: ficha.pessoal.email } : {}),
      ...(c.phone ? {} : { phone: ficha.pessoal.celular }),
    },
  });
  if (count === 0) return { error: "Esta ficha já foi enviada." };

  // Quem mandou pelo quadro já marcou o envio; quem passou o link de outro jeito não.
  await prisma.candidate.updateMany({ where: { id: c.id, applicationSentAt: null }, data: { applicationSentAt: agora } });

  if (c.jobOpeningId) revalidatePath(`/selecao/${c.jobOpeningId}`, "layout");
  revalidatePath("/selecao");
  if (c.companyId) revalidatePath(`/empresas/${c.companyId}`, "layout");
  return { ok: true };
}
