import { semAcento } from "@/lib/text";

/**
 * Quem não é funcionário da empresa e por isso fica numa aba própria da
 * Equipe e fora do PDI e da autoavaliação: os dentistas, prestadores de
 * serviço, e os protéticos, do laboratório. São reconhecidos pelo cargo
 * ("Dentista avaliador", "Protético(a)"...), sem campo próprio no banco.
 */
export type GrupoDePrestador = "dentistas" | "laboratorio";

export function grupoDoCargo(cargo: string | null | undefined): GrupoDePrestador | null {
  const nome = semAcento(cargo ?? "").toLowerCase();
  if (nome.includes("dentista")) return "dentistas";
  if (nome.includes("protetic")) return "laboratorio";
  return null;
}

/** Dentistas e laboratório não têm PDI nem autoavaliação. */
export function foraDoPdi(cargo: string | null | undefined): boolean {
  return grupoDoCargo(cargo) != null;
}
