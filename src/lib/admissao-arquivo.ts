import "server-only";
import { prisma } from "./prisma";
import { textoSeguro } from "./texto-seguro";
import { ARQUIVOS_POR_ADMISSAO, TAMANHO_DO_ARQUIVO, documentoDaChave, nomeDoArquivo, tipoDoArquivo } from "./admissao";

/**
 * Guarda um arquivo da admissão, venha do RH ou do funcionário pelo link.
 * Fica fora dos arquivos de "use server" de propósito: lá ele viraria uma
 * ação que qualquer um chama, sem sessão e sem token.
 */
export async function guardarArquivo(
  admissaoId: string,
  tipo: string,
  arquivo: FormDataEntryValue | null,
  enviadoPor: string,
): Promise<{ error?: string; ok?: boolean }> {
  if (!documentoDaChave(tipo)) return { error: "Escolha qual documento é." };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: "Escolha a foto ou o PDF." };
  if (arquivo.size > TAMANHO_DO_ARQUIVO) return { error: "O arquivo passa de 4 MB. Tire a foto de novo ou mande um PDF menor." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = tipoDoArquivo(bytes.subarray(0, 1100));
  if (!mime) return { error: "Mande uma foto (JPG ou PNG) ou um PDF." };

  const total = await prisma.documentoDaAdmissao.count({ where: { admissaoId } });
  if (total >= ARQUIVOS_POR_ADMISSAO) return { error: "Esta admissão já tem arquivos demais. Fale com o RH." };

  await prisma.documentoDaAdmissao.create({
    data: { admissaoId, tipo, nome: textoSeguro(nomeDoArquivo(arquivo.name, mime)), mime, tamanho: bytes.length, dados: bytes, enviadoPor },
  });
  return { ok: true };
}

