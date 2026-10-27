import { semAcento } from "@/lib/text";

/**
 * Quem não é funcionário da empresa e por isso fica numa aba própria da
 * Equipe e fora do PDI e da autoavaliação: os dentistas e os protéticos (do
 * laboratório), reconhecidos pelo cargo ("Dentista avaliador",
 * "Protético(a)"...), e quem está marcado como prestador no cadastro.
 */
export type GrupoDePrestador = "dentistas" | "laboratorio" | "prestadores";

export function grupoDoCargo(cargo: string | null | undefined, prestador = false): GrupoDePrestador | null {
  const nome = semAcento(cargo ?? "").toLowerCase();
  if (nome.includes("dentista")) return "dentistas";
  if (nome.includes("protetic")) return "laboratorio";
  return prestador ? "prestadores" : null;
}

/** Dentistas, laboratório e prestadores não têm PDI nem autoavaliação. */
export function foraDoPdi(cargo: string | null | undefined, prestador = false): boolean {
  return grupoDoCargo(cargo, prestador) != null;
}
