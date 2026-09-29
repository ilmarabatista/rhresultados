/**
 * Os produtos do catálogo da consultoria, como aparecem nas telas.
 *
 * Puro, sem banco: é o que a tela, as ações e os testes leem.
 */

/**
 * O nome curto de cada produto do catálogo, para as listas onde o nome
 * inteiro não cabe. Escolhidos pela consultora em 15/09/2026; produto sem
 * nome curto aparece com o nome inteiro.
 */
const NOMES_CURTOS: Record<string, string> = {
  "recrutamento-selecao": "R&S",
  "analise-clima": "PCC",
  "fortalecimento-cultura": "Cultura",
  "habilidades-comunicacao": "PNL",
  "ciclo-feedback": "Feedback",
  pdi: "PDI",
  endomarketing: "Endo",
  celebracoes: "Celebração",
  "reuniao-de-nps": "NPS",
};

/**
 * O nome curto do produto. Quando o nome leva um complemento depois do nome
 * do catálogo — "Treinamento — Recepção" —, o complemento fica: só a parte do
 * catálogo encurta.
 */
export function nomeCurto(
  slug: string | null | undefined,
  nome: string,
  nomeDoCatalogo?: string | null,
): string {
  const curto = slug ? NOMES_CURTOS[slug] : undefined;
  if (!curto) return nome;
  if (!nomeDoCatalogo || nome === nomeDoCatalogo) return curto;
  return nome.startsWith(nomeDoCatalogo) ? `${curto}${nome.slice(nomeDoCatalogo.length)}` : nome;
}
