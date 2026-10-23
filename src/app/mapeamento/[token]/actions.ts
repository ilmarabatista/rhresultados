"use server";

import { prisma } from "@/lib/prisma";
import { conferirMapeamento, juntarDaPessoa, lerDados } from "@/lib/mapeamento";

/**
 * O mapeamento de rotinas preenchido pelo link. Não há sessão: o token é a
 * credencial. A pessoa só escreve as seções dela: as observações do RH ficam
 * como estão no banco, seja o que for que chegue.
 */

export type MapeamentoPublicoState = { error?: string; ok?: boolean };

/** Um mapeamento bem detalhado fica em poucas dezenas de KB. */
const TETO_DO_ENVIO = 200_000;

async function abrir(token: string, json: string) {
  if (!token || json.length > TETO_DO_ENVIO) return null;
  const m = await prisma.mapeamentoDeRotina.findUnique({ where: { token }, select: { id: true, status: true, dados: true } });
  if (!m) return null;
  let cru: unknown;
  try {
    cru = JSON.parse(json);
  } catch {
    return null;
  }
  return { id: m.id, status: m.status, dados: juntarDaPessoa(lerDados(m.dados), cru) };
}

export async function guardarMapeamento(token: string, json: string): Promise<MapeamentoPublicoState> {
  const m = await abrir(token, json);
  if (!m) return { error: "Não foi possível guardar. Confira o link." };
  if (m.status !== "ENVIADO") return { error: "Este mapeamento já foi enviado." };
  await prisma.mapeamentoDeRotina.updateMany({ where: { id: m.id, status: "ENVIADO" }, data: { dados: m.dados } });
  return { ok: true };
}

export async function enviarMapeamento(token: string, json: string): Promise<MapeamentoPublicoState> {
  const m = await abrir(token, json);
  if (!m) return { error: "Não foi possível enviar. Confira o link." };
  if (m.status !== "ENVIADO") return { error: "Este mapeamento já foi enviado." };
  const problema = conferirMapeamento(m.dados);
  if (problema) return { error: problema };

  // O `status` na condição impede dois envios ao mesmo tempo no mesmo link.
  const { count } = await prisma.mapeamentoDeRotina.updateMany({
    where: { id: m.id, status: "ENVIADO" },
    data: { status: "RESPONDIDO", dados: m.dados, respondidoEm: new Date() },
  });
  if (count === 0) return { error: "Este mapeamento já foi enviado." };
  return { ok: true };
}
