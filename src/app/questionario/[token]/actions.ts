"use server";

import { prisma } from "@/lib/prisma";
import { conferirParaEnviar, lerNivelDeCargo, lerRespostas } from "@/lib/cargos";

/**
 * O questionário de cargo respondido pelo link. Não há sessão: o token é a
 * credencial. Enquanto não é enviado, cada pausa guarda o que já foi escrito,
 * para a pessoa voltar depois pelo mesmo link.
 */

export type QuestionarioState = { error?: string; ok?: boolean };

/** Um questionário inteiro bem respondido fica em poucas dezenas de KB. */
const TETO_DO_ENVIO = 300_000;

async function abrir(token: string, json: string) {
  if (!token || json.length > TETO_DO_ENVIO) return null;
  const q = await prisma.questionarioDeCargo.findUnique({ where: { token }, select: { id: true, nivel: true, status: true } });
  const nivel = q ? lerNivelDeCargo(q.nivel) : null;
  if (!q || !nivel) return null;
  let cru: unknown;
  try {
    cru = JSON.parse(json);
  } catch {
    return null;
  }
  return { ...q, nivel, respostas: lerRespostas(nivel, cru) };
}

export async function guardarRascunho(token: string, json: string): Promise<QuestionarioState> {
  const q = await abrir(token, json);
  if (!q) return { error: "Não foi possível guardar. Confira o link." };
  if (q.status !== "ENVIADO") return { error: "Este questionário já foi enviado." };
  await prisma.questionarioDeCargo.updateMany({ where: { id: q.id, status: "ENVIADO" }, data: { respostas: q.respostas } });
  return { ok: true };
}

export async function enviarQuestionario(token: string, json: string): Promise<QuestionarioState> {
  const q = await abrir(token, json);
  if (!q) return { error: "Não foi possível enviar. Confira o link." };
  if (q.status !== "ENVIADO") return { error: "Este questionário já foi enviado." };
  const problema = conferirParaEnviar(q.nivel, q.respostas);
  if (problema) return { error: problema };

  // O `status` na condição impede dois envios ao mesmo tempo no mesmo link.
  const { count } = await prisma.questionarioDeCargo.updateMany({
    where: { id: q.id, status: "ENVIADO" },
    data: { status: "RESPONDIDO", respostas: q.respostas, respondidoEm: new Date() },
  });
  if (count === 0) return { error: "Este questionário já foi enviado." };
  return { ok: true };
}
