import { addDaysUTC, dateToDayKey, dayKeyToDate, todayKey } from "./dates";

/** Quem marcou a folga, como aparece para o RH em Empresa → Ponto → Ocorrências. */
export const MARCADA_PELO_COLABORADOR = "Marcada pelo colaborador";

/** Até quantos dias para trás e para a frente o colaborador pode marcar folga. */
export const JANELA_DA_FOLGA = 30;

/** O primeiro e o último dia que o colaborador pode marcar, a partir de hoje. */
export function limitesDaFolga() {
  const hoje = dayKeyToDate(todayKey());
  return { de: dateToDayKey(addDaysUTC(hoje, -JANELA_DA_FOLGA)), ate: dateToDayKey(addDaysUTC(hoje, JANELA_DA_FOLGA)) };
}
