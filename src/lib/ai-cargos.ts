import "server-only";
import { chamarIA, extractJson } from "./ai-cliente";
import { lerPerguntas } from "./entrevista";
import {
  descricaoDaIA,
  pedidoDaDescricao,
  pedidoDasPerguntas,
  SYSTEM_DA_DESCRICAO,
  SYSTEM_DAS_PERGUNTAS,
  type DescricaoSugerida,
  type NivelDeCargo,
} from "./cargos";
import type { TipoDeCompetencia } from "./pdi";

/**
 * A IA da aba Cargos: o rascunho da descrição a partir dos questionários e as
 * perguntas de entrevista a partir da descrição.
 *
 * Vai pelo modelo gratuito, como ela pediu: as respostas falam do cargo, não
 * de uma pessoa, e o nome de quem respondeu não vai.
 */
export async function rascunharDescricao(
  cargo: string,
  nivel: NivelDeCargo,
  questionarios: string[],
  valores: string,
): Promise<DescricaoSugerida> {
  const bruto = await chamarIA(SYSTEM_DA_DESCRICAO, pedidoDaDescricao(cargo, nivel, questionarios, valores), 8_000);
  return descricaoDaIA(extractJson(bruto));
}

export async function sugerirPerguntas(d: {
  nome: string;
  missao: string;
  responsabilidades: string[];
  requisitos: string;
  competencias: { nome: string; tipo: TipoDeCompetencia; descricao: string }[];
}): Promise<string[]> {
  const bruto = await chamarIA(SYSTEM_DAS_PERGUNTAS, pedidoDasPerguntas(d), 4_000);
  const obj = extractJson(bruto) as { perguntas?: unknown };
  return lerPerguntas(obj?.perguntas);
}
