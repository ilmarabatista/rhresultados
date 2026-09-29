/**
 * Texto que o banco aceita.
 *
 * O banco deste sistema foi criado com codificação WIN1252, que é o padrão do
 * Postgres instalado em Windows em português. WIN1252 cobre todo o português —
 * acento, cedilha, travessão, aspas curvas, reticências, bullet — mas não cobre
 * emoji. Gravar um emoji ali não dá texto torto: dá erro, e a operação inteira
 * falha.
 *
 * Como a IA gosta de enfeitar texto com emoji, tudo que vem dela passa por
 * aqui antes de ser gravado. A alternativa de verdade é migrar o banco para
 * UTF-8; enquanto isso não acontece, isto evita a tela de erro.
 */

/**
 * Os caracteres que o WIN1252 tem além do Latin-1.
 *
 * São os da faixa 0x80–0x9F da tabela: aspas curvas, travessão, reticências,
 * bullet, euro e afins — justamente os que aparecem em texto bem escrito.
 */
const EXTRAS_DO_WIN1252 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/**
 * O que trocar antes de apagar.
 *
 * Há caracteres fora do WIN1252 que são só a versão fina de um que existe:
 * o hífen que não quebra linha, a seta, o espaço estreito. Apagá-los colaria
 * palavras — "quinta-feira" virando "quintafeira" —, então eles viram o
 * parente mais próximo em vez de sumir.
 */
const TROCAS: Record<string, string> = {
  "‑": "-", // hífen que não quebra linha
  "‒": "-", // traço de algarismo
  "―": "—", // barra horizontal
  "−": "-", // sinal de menos
  "­": "", // hífen invisível de quebra
  " ": " ",
  " ": " ",
  " ": " ",
  "→": "->",
  "←": "<-",
  "✓": "ok",
  "✔": "ok",
  "☐": "[ ]",
  "☑": "[x]",
};

/** O caractere cabe no banco? */
export function cabeNoBanco(caractere: string): boolean {
  const c = caractere.codePointAt(0);
  if (c === undefined) return false;
  return c <= 0xff || EXTRAS_DO_WIN1252.has(c);
}

/**
 * O texto sem o que o banco não aceita.
 *
 * O que sai é emoji e sinal invisível de emoji. Espaço que sobra de um emoji
 * removido no meio da frase é limpo, para não deixar buraco duplo.
 */
export function textoSeguro(texto: string): string {
  let mudou = false;

  const limpo = [...texto]
    .map((c) => {
      if (cabeNoBanco(c)) return c;
      mudou = true;
      return TROCAS[c] ?? "";
    })
    .join("");

  if (!mudou) return texto;

  return limpo
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+(\n)/g, "$1")
    .replace(/(\n)[ \t]+/g, "$1")
    .trim();
}

/** O texto tem algo que o banco não aceita? */
export function temCaractereProibido(texto: string): boolean {
  return [...texto].some((c) => !cabeNoBanco(c));
}
