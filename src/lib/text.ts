/** Transformações de texto usadas em mais de um lugar, todas puras. */

/** Remove acentos, mantendo a letra base. */
export function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Identificador estável a partir de um nome legível.
 * "Avaliação de Desempenho" -> "avaliacao-de-desempenho"
 */
export function slugify(texto: string): string {
  return semAcento(texto)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

/** Iniciais para avatares: no máximo duas letras. */
export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Quebra um texto colado em itens, um por linha, tirando marcadores de lista
 * ("1.", "-", "•") que o usuário costuma trazer junto.
 */
export function linhasComoItens(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}
