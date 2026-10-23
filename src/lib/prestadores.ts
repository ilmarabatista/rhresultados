import { semAcento } from "@/lib/text";

/**
 * Os dentistas são prestadores de serviço, não funcionários: ficam numa aba
 * própria da Equipe e fora do PDI e da autoavaliação. São reconhecidos pelo
 * cargo ("Dentista", "Dentista avaliador"...), sem campo próprio no banco.
 */
export function ehDentista(cargo: string | null | undefined): boolean {
  return semAcento(cargo ?? "").toLowerCase().includes("dentista");
}
