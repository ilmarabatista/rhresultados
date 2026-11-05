"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { guardarArquivo } from "@/lib/admissao-arquivo";
import { cpfValido, documentoDaChave, soNumeros } from "@/lib/admissao";
import { diaValido } from "@/lib/agenda";
import { dayKeyToDate } from "@/lib/dates";
import { textoSeguro } from "@/lib/texto-seguro";

/**
 * Os documentos da admissão mandados pelo link. Não há sessão: o token é a
 * credencial. Depois que o RH baixa o pacote para a contabilidade, o link
 * fecha.
 */

export type DocumentoPublicoState = { error?: string; ok?: boolean };

async function abrir(token: string) {
  if (!token) return null;
  const a = await prisma.admissao.findUnique({ where: { token }, select: { id: true, pacoteGeradoEm: true, naoSeAplica: true } });
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

/** O funcionário responde CPF, nascimento e função pelo link dos dados. */
export async function responderDados(_: DocumentoPublicoState, formData: FormData): Promise<DocumentoPublicoState> {
  const token = String(formData.get("token") ?? "");
  const a = await abrir(token);
  if (!a) return { error: "Este link não recebe mais respostas. Fale com o RH." };

  const cpf = soNumeros(String(formData.get("cpf") ?? ""));
  const nascimento = String(formData.get("dataNascimento") ?? "").trim();
  const funcao = textoSeguro(String(formData.get("funcao") ?? "").trim()).slice(0, 120);
  if (!cpfValido(cpf)) return { error: "Confira o CPF: os números não batem." };
  if (!diaValido(nascimento)) return { error: "Escolha a sua data de nascimento." };
  const dataNascimento = dayKeyToDate(nascimento);
  const ano = dataNascimento.getUTCFullYear();
  if (ano < 1930 || ano > new Date().getFullYear() - 14) return { error: "Confira o ano de nascimento." };
  if (!funcao) return { error: "Escreva a sua função." };

  await prisma.admissao.update({
    where: { id: a.id },
    data: { cpf, dataNascimento, funcao, dadosPreenchidosEm: new Date() },
  });
  refresh(a.id, token);
  revalidatePath(`/admissao/${token}/dados`);
  return { ok: true };
}

/** O funcionário marca (ou desmarca) "Não se aplica": não tem filhos, não é reservista... */
export async function marcarNaoSeAplica(token: string, chave: string, marcar: boolean): Promise<DocumentoPublicoState> {
  const a = await abrir(token);
  if (!a) return { error: "Este link não recebe mais documentos. Fale com o RH." };
  const doc = documentoDaChave(chave);
  if (!doc || doc.obrigatorio) return { error: "Este documento é obrigatório." };
  const lista = a.naoSeAplica.filter((c) => c !== chave);
  await prisma.admissao.update({ where: { id: a.id }, data: { naoSeAplica: marcar ? [...lista, chave] : lista } });
  refresh(a.id, token);
  return { ok: true };
}
