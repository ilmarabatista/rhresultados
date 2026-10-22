import "server-only";
import { chamarIA, extractJson } from "./ai-cliente";
import { pedidoDaEntrevista, respostasDaIA, SYSTEM_DA_ENTREVISTA, type RespostaDaEntrevista } from "./entrevista";

/**
 * Organiza a transcrição da entrevista nas perguntas da vaga.
 *
 * Marcada como privada: se um dia houver modelo pago configurado, a
 * transcrição (dado pessoal do candidato) vai por ele, com retenção zero.
 */
export async function organizarTranscricao(
  perguntas: string[],
  transcricao: string,
): Promise<{ respostas: RespostaDaEntrevista[]; outros: string }> {
  const bruto = await chamarIA(SYSTEM_DA_ENTREVISTA, pedidoDaEntrevista(perguntas, transcricao), 12_000, { privado: true });
  return respostasDaIA(extractJson(bruto), perguntas);
}
