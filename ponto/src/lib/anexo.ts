/**
 * O arquivo do atestado: foto (reduzida no celular antes de sair) ou PDF.
 * O tipo é conferido pelos primeiros bytes, não pelo nome nem pelo que o
 * navegador disse.
 */

/** Maior anexo aceito. A Vercel recusa corpo acima de 4,5 MB. */
export const MAXIMO_DO_ANEXO = 3_500_000;

const ASSINATURAS: { tipo: string; bytes: number[] }[] = [
  { tipo: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { tipo: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { tipo: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

/** O tipo do arquivo pelos primeiros bytes, ou null quando não é foto nem PDF. */
export function tipoDoAnexo(dados: Uint8Array): string | null {
  return ASSINATURAS.find((a) => a.bytes.every((b, i) => dados[i] === b))?.tipo ?? null;
}

export type AnexoLido = { nome: string; tipo: string; dados: Buffer };

/** Confere o arquivo enviado. Devolve o anexo ou a mensagem de erro. */
export async function lerAnexo(arquivo: FormDataEntryValue | null): Promise<AnexoLido | string | null> {
  if (!arquivo || typeof arquivo === "string" || arquivo.size === 0) return null;
  if (arquivo.size > MAXIMO_DO_ANEXO) return "O arquivo passou de 3,5 MB. Mande uma foto ou um PDF menor.";
  const dados = Buffer.from(await arquivo.arrayBuffer());
  const tipo = tipoDoAnexo(dados);
  if (!tipo) return "Mande uma foto (JPG ou PNG) ou um PDF.";
  const nome = (arquivo.name || "atestado").replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 100) || "atestado";
  return { nome, tipo, dados };
}
