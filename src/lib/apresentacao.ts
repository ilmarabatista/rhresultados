/**
 * Regras do arquivo de apresentação anexado a uma reunião, usadas pela tela e
 * pelo servidor.
 *
 * Tamanho: a Vercel recusa requisições acima de 4,5 MB antes de chegarem ao
 * sistema, então o teto real é 4 MB (o resto é a margem do envio).
 *
 * Tipo: decidido pela extensão, numa lista fechada. O tipo que o navegador
 * informa vem de quem envia e não é confiável.
 */

export const TAMANHO_MAXIMO = 4 * 1024 * 1024;
export const TAMANHO_MAXIMO_TEXTO = "4 MB";

const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  key: "application/vnd.apple.keynote",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

/** Para o `accept` do campo de arquivo. */
export const EXTENSOES_ACEITAS = Object.keys(TIPOS).map((e) => `.${e}`).join(",");

/** O tipo do arquivo pela extensão, ou null quando não é aceito. */
export function tipoDaApresentacao(nome: string): string | null {
  const extensao = nome.toLowerCase().split(".").pop() ?? "";
  return TIPOS[extensao] ?? null;
}
