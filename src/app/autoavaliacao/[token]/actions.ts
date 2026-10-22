"use server";

import { prisma } from "@/lib/prisma";
import { conferirParaEnviar, lerPerguntas, lerRespostas } from "@/lib/autoavaliacao";

/**
 * A autoavaliação respondida pelo link. Não há sessão: o token é a
 * credencial. Enquanto não é enviada, cada pausa guarda o que já foi marcado,
 * para a pessoa voltar depois pelo mesmo link.
 */

export type AutoavaliacaoPublicaState = { error?: string; ok?: boolean };

/** Uma ficha inteira com as abertas bem escritas fica em poucas dezenas de KB. */
const TETO_DO_ENVIO = 200_000;

async function abrir(token: string, json: string) {
  if (!token || json.length > TETO_DO_ENVIO) return null;
  const a = await prisma.autoavaliacao.findUnique({ where: { token }, select: { id: true, status: true, perguntas: true } });
  if (!a) return null;
  let cru: unknown;
  try {
    cru = JSON.parse(json);
  } catch {
    return null;
  }
  const perguntas = lerPerguntas(a.perguntas);
  return { id: a.id, status: a.status, perguntas, respostas: lerRespostas(perguntas, cru) };
}

export async function guardarRascunho(token: string, json: string): Promise<AutoavaliacaoPublicaState> {
  const a = await abrir(token, json);
  if (!a) return { error: "Não foi possível guardar. Confira o link." };
  if (a.status !== "ENVIADO") return { error: "Esta autoavaliação já foi enviada." };
  await prisma.autoavaliacao.updateMany({ where: { id: a.id, status: "ENVIADO" }, data: { respostas: a.respostas } });
  return { ok: true };
}

export async function enviarAutoavaliacao(token: string, json: string): Promise<AutoavaliacaoPublicaState> {
  const a = await abrir(token, json);
  if (!a) return { error: "Não foi possível enviar. Confira o link." };
  if (a.status !== "ENVIADO") return { error: "Esta autoavaliação já foi enviada." };
  const problema = conferirParaEnviar(a.perguntas, a.respostas);
  if (problema) return { error: problema };

  // O `status` na condição impede dois envios ao mesmo tempo no mesmo link.
  const { count } = await prisma.autoavaliacao.updateMany({
    where: { id: a.id, status: "ENVIADO" },
    data: { status: "RESPONDIDO", respostas: a.respostas, respondidoEm: new Date() },
  });
  if (count === 0) return { error: "Esta autoavaliação já foi enviada." };
  return { ok: true };
}
