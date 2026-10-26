import "server-only";
import { chamarIA, extractJson } from "./ai-cliente";
import { ataDaIA, pedidoDaReuniao, SYSTEM_DA_REUNIAO, type AtaDaIA } from "./reuniao-gravada";

/**
 * Monta o resumo e a ata da reunião a partir da transcrição.
 *
 * Marcada como privada: o que se fala numa reunião de RH é dado pessoal, e se
 * houver modelo pago configurado ela vai por ele, com retenção zero.
 */
export async function organizarReuniao(c: Parameters<typeof pedidoDaReuniao>[0]): Promise<AtaDaIA> {
  const bruto = await chamarIA(SYSTEM_DA_REUNIAO, pedidoDaReuniao(c), 8_000, { privado: true });
  return ataDaIA(extractJson(bruto));
}
