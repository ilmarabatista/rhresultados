"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { guardarArquivo } from "@/lib/admissao-arquivo";

/**
 * Os documentos da admissão mandados pelo link. Não há sessão: o token é a
 * credencial. Depois que o RH baixa o pacote para a contabilidade, o link
 * fecha.
 */

export type DocumentoPublicoState = { error?: string; ok?: boolean };

async function abrir(token: string) {
  if (!token) return null;
  const a = await prisma.admissao.findUnique({ where: { token }, select: { id: true, pacoteGeradoEm: true } });
  if (!a || a.pacoteGeradoEm) return null;
  return a;
}

function refresh(id: string, token: string) {
  revalidatePath(`/admissao/${token}`);
  revalidatePath(`/admissoes/${id}`);
}

export async function enviarDocumento(formData: FormData): Promise<DocumentoPublicoState> {
  const token = String(formData.get("token") ?? "");
  const a = await abrir(token);
  if (!a) return { error: "Este link não recebe mais documentos. Fale com o RH." };
  const r = await guardarArquivo(a.id, String(formData.get("tipo") ?? ""), formData.get("arquivo"), "FUNCIONARIO");
  if (r.error) return r;
  refresh(a.id, token);
  return { ok: true };
}

/** O funcionário tira a foto errada: pode tirar a que ele mesmo mandou. */
export async function removerDocumento(token: string, arquivoId: string): Promise<DocumentoPublicoState> {
  const a = await abrir(token);
  if (!a) return { error: "Este link não recebe mais documentos. Fale com o RH." };
  const { count } = await prisma.documentoDaAdmissao.deleteMany({
    where: { id: arquivoId, admissaoId: a.id, enviadoPor: "FUNCIONARIO" },
  });
  if (count === 0) return { error: "Arquivo não encontrado." };
  refresh(a.id, token);
  return { ok: true };
}

export async function terminarEnvio(token: string): Promise<DocumentoPublicoState> {
  const a = await abrir(token);
  if (!a) return { error: "Este link não recebe mais documentos. Fale com o RH." };
  await prisma.admissao.update({ where: { id: a.id }, data: { documentosEnviadosEm: new Date() } });
  refresh(a.id, token);
  return { ok: true };
}
