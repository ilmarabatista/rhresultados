"use server";

import { prisma } from "@/lib/prisma";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import { conferirResposta, lerPerfil, lerResposta } from "@/lib/clima";
import { paraAplicada } from "@/lib/clima-dados";

/**
 * A resposta anônima da pesquisa de clima, pelo link. Não há sessão: o link é
 * a credencial, e vale enquanto a pesquisa estiver aberta e no prazo.
 *
 * Não se grava nada que identifique quem respondeu: nem IP, nem hora, nem um
 * id que carregue o momento. Só o dia.
 */

export type RespostaClimaState = { error?: string; ok?: boolean };

export async function responderClima(_prev: RespostaClimaState, formData: FormData): Promise<RespostaClimaState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Link inválido." };

  const pesquisa = await prisma.pesquisaDeClima.findUnique({
    where: { token },
    select: { id: true, status: true, prazo: true, perfil: true, perguntas: true },
  });
  if (!pesquisa || pesquisa.status === "RASCUNHO" || pesquisa.status === "HISTORICO") return { error: "Link inválido." };
  const hoje = todayKey();
  if (pesquisa.status !== "ABERTA" || (pesquisa.prazo && pesquisa.prazo < dayKeyToDate(hoje))) {
    return { error: "A pesquisa já foi encerrada." };
  }

  const perguntas = pesquisa.perguntas.map(paraAplicada);
  const perfil = lerPerfil(pesquisa.perfil);
  const resposta = lerResposta(perguntas, perfil, (campo) => formData.getAll(campo).map(String));
  const problema = conferirResposta(perguntas, perfil, resposta);
  if (problema) return { error: problema };

  await prisma.respostaDeClima.create({
    data: {
      pesquisaId: pesquisa.id,
      perfil: resposta.perfil,
      respondidaEm: dayKeyToDate(hoje),
      itens: {
        create: resposta.itens.map((i) => ({ perguntaId: i.perguntaId, nota: i.nota, escolhas: i.escolhas, texto: i.texto })),
      },
    },
  });
  return { ok: true };
}
