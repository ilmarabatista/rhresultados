/**
 * Geração de CSV para o Excel em português.
 *
 * Duas escolhas que definem o formato: separador ponto e vírgula (o Excel em
 * pt-BR usa vírgula como decimal, então vírgula como separador junta tudo numa
 * coluna só) e BOM UTF-8 na frente (sem ele, acentos saem embaralhados).
 */

const BOM = "\uFEFF";
const SEPARADOR = ";";
const QUEBRA = "\r\n";

/**
 * Texto que o Excel leria como fórmula (=, +, -, @) ganha um apóstrofo na
 * frente e fica texto. Números e horas negativos ("-1:30", "-12,5") passam
 * como estão.
 */
function semFormula(texto: string): string {
  if (!/^[=+\-@\t]/.test(texto)) return texto;
  if (/^[-+]?\d[\d.,:]*$/.test(texto)) return texto;
  return `'${texto}`;
}

/** Envolve o valor em aspas, escapando as aspas internas e achatando quebras. */
export function celula(valor: string | null | undefined): string {
  const texto = semFormula((valor ?? "").replace(/\r?\n/g, " ").trim());
  return `"${texto.replace(/"/g, '""')}"`;
}

export function linha(valores: (string | null | undefined)[]): string {
  return valores.map(celula).join(SEPARADOR);
}

/** Monta o arquivo completo, com cabeçalho e BOM. */
export function montarCsv(
  cabecalho: string[],
  linhas: (string | null | undefined)[][],
): string {
  return BOM + [linha(cabecalho), ...linhas.map(linha)].join(QUEBRA);
}
