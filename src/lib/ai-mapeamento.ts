import "server-only";
import { chamarIA, extractJson } from "./ai-cliente";
import {
  itensDaIA,
  lerDados,
  pedidoDoMapeamento,
  SYSTEM_DO_MAPEAMENTO,
  SYSTEM_DOS_ITENS,
  textoDoMapeamentoParaIA,
  type DadosDoMapeamento,
  type ItemSugerido,
} from "./mapeamento";

/**
 * A IA do mapeamento de rotinas: organiza a transcrição da entrevista nas
 * seções e sugere os itens da autoavaliação da função.
 *
 * A transcrição fala de uma pessoa, então vai como privada: se um dia houver
 * modelo pago configurado, segue por ele, com retenção zero.
 */
export async function organizarMapeamento(
  contexto: { cargo: string; setor: string },
  transcricao: string,
): Promise<DadosDoMapeamento> {
  const bruto = await chamarIA(SYSTEM_DO_MAPEAMENTO, pedidoDoMapeamento(contexto, transcricao), 12_000, { privado: true });
  return lerDados(extractJson(bruto));
}

/** Os itens saem do que a pessoa faz, não de quem ela é: nome e observações do RH não vão. */
export async function sugerirItens(d: DadosDoMapeamento): Promise<ItemSugerido[]> {
  const bruto = await chamarIA(SYSTEM_DOS_ITENS, textoDoMapeamentoParaIA(d), 8_000);
  return itensDaIA(extractJson(bruto));
}
