import "server-only";
import { chamarIA, extractJson } from "./ai-cliente";
import { pedidoDaEntrevista, respostasDaIA, SYSTEM_DA_ENTREVISTA, type RespostaDaEntrevista } from "./entrevista";

/**
 * Organiza a transcrição da entrevista nas perguntas da vaga.
 *
 * Vai pelo modelo privado: a transcrição tem dado pessoal do candidato e não
 * pode passar por modelo que guarda o que recebe.
 */
export async function organizarTranscricao(
  perguntas: string[],
  transcricao: string,
): Promise<{ respostas: RespostaDaEntrevista[]; outros: string }> {
  const bruto = await chamarIA(SYSTEM_DA_ENTREVISTA, pedidoDaEntrevista(perguntas, transcricao), 12_000, { privado: true });
  return respostasDaIA(extractJson(bruto), perguntas);
}
