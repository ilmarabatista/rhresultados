/**
 * O currículo anexado ao candidato: só PDF, até 4 MB.
 *
 * O teto é o da Vercel para o corpo de uma requisição (4,5 MB), com folga
 * para o resto do formulário. O tipo é conferido pelos primeiros bytes do
 * arquivo, que todo PDF começa com "%PDF-": o nome e o tipo que o navegador
 * informa podem dizer qualquer coisa.
 */

export const TAMANHO_DO_CURRICULO = 4 * 1024 * 1024;
export const TAMANHO_DO_CURRICULO_TEXTO = "4 MB";

export function ehPdf(bytes: Uint8Array): boolean {
  const assinatura = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  // Alguns geradores põem lixo antes do cabeçalho; o padrão tolera até 1 KB.
  const ate = Math.min(bytes.length - assinatura.length, 1024);
  for (let i = 0; i <= ate; i++) {
    if (assinatura.every((b, k) => bytes[i + k] === b)) return true;
  }
  return false;
}

/** O que impede de guardar o arquivo, ou null quando ele serve. */
export function problemaDoCurriculo(tamanho: number, inicio: Uint8Array): string | null {
  if (tamanho === 0) return "Escolha o arquivo do currículo.";
  if (tamanho > TAMANHO_DO_CURRICULO) {
    return `O arquivo passa de ${TAMANHO_DO_CURRICULO_TEXTO}. Salve o PDF em tamanho menor (ou em preto e branco) e envie de novo.`;
  }
  if (!ehPdf(inicio)) return "O arquivo não é um PDF. Salve o currículo como PDF e envie de novo.";
  return null;
}

/** "curriculo maria.pdf" sempre terminando em .pdf, sem caminho nem caractere estranho. */
export function nomeDoCurriculo(nome: string): string {
  const base = nome.split(/[\\/]/).pop() ?? "";
  const limpo = base.replace(/[\u0000-\u001f"<>|*?:]/g, "").trim().slice(0, 150);
  if (!limpo) return "curriculo.pdf";
  return /\.pdf$/i.test(limpo) ? limpo : `${limpo}.pdf`;
}

/** 312000 → "305 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
