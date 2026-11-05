"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido } from "@/lib/agenda";
import { dayKeyToDate } from "@/lib/dates";
import { textoSeguro } from "@/lib/texto-seguro";
import { cpfValido, documentoDaChave, soNumeros } from "@/lib/admissao";
import { guardarArquivo } from "@/lib/admissao-arquivo";

/**
 * Assinatura de carteira, do lado do RH: os dados iniciais, os avisos de que
 * a mensagem foi ao médico e ao funcionário, os arquivos e a ficha da Equipe.
 */

export type AdmissaoState = { error?: string; ok?: boolean; id?: string };

const log = atividade("ADMISSAO");

function refresh(companyId: string, id?: string) {
  revalidatePath("/admissoes");
  if (id) revalidatePath(`/admissoes/${id}`);
  revalidatePath(`/empresas/${companyId}/admissoes`);
}

function texto(formData: FormData, campo: string, max = 200): string {
  return textoSeguro(String(formData.get(campo) ?? "").trim()).slice(0, max);
}

function dia(formData: FormData, campo: string): Date | null {
  const v = String(formData.get(campo) ?? "").trim();
  return diaValido(v) ? dayKeyToDate(v) : null;
}

/** Lê e confere os dados iniciais, comuns a criar e a editar. */
function lerDados(formData: FormData) {
  const cnpj = soNumeros(String(formData.get("cnpj") ?? ""));
  const nome = texto(formData, "nome", 150);
  const cpf = soNumeros(String(formData.get("cpf") ?? ""));
  const dataNascimento = dia(formData, "dataNascimento");
  const funcao = texto(formData, "funcao", 120);

  if (cnpj.length !== 14) return { error: "Confira o CNPJ: são 14 números." } as const;
  if (!nome) return { error: "Escreva o nome do funcionário." } as const;
  if (!cpfValido(cpf)) return { error: "Confira o CPF: os números não batem." } as const;
  if (!dataNascimento) return { error: "Escolha a data de nascimento." } as const;
  if (!funcao) return { error: "Escreva a função." } as const;

  return {
    dados: {
      cnpj,
      nome,
      cpf,
      dataNascimento,
      funcao,
      telefone: soNumeros(String(formData.get("telefone") ?? "")).slice(0, 13) || null,
      dataAdmissao: dia(formData, "dataAdmissao"),
      observacoes: texto(formData, "observacoes", 2000) || null,
    },
  } as const;
}

export async function criarAdmissao(_: AdmissaoState, formData: FormData): Promise<AdmissaoState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, cnpj: true } });
  if (!empresa) return { error: "Escolha a empresa." };

  const lido = lerDados(formData);
  if ("error" in lido) return { error: lido.error };

  const a = await prisma.admissao.create({
    data: { ...lido.dados, companyId, token: randomBytes(18).toString("base64url"), criadoPor: session.name },
    select: { id: true },
  });

  // A empresa sem CNPJ no cadastro fica com o que foi digitado aqui.
  if (!empresa.cnpj) {
    await prisma.company.update({ where: { id: companyId }, data: { cnpj: lido.dados.cnpj } }).catch(() => null);
  }

  await log(companyId, session.userId, "CRIOU", a.id, `Abriu a admissão de ${lido.dados.nome} (${lido.dados.funcao}).`);
  refresh(companyId);
  redirect(`/admissoes/${a.id}`);
}

export async function editarAdmissao(_: AdmissaoState, formData: FormData): Promise<AdmissaoState> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const a = await prisma.admissao.findUnique({ where: { id }, select: { companyId: true } });
  if (!a) return { error: "Admissão não encontrada." };

  const lido = lerDados(formData);
  if ("error" in lido) return { error: lido.error };

  await prisma.admissao.update({ where: { id }, data: lido.dados });
  await log(a.companyId, session.userId, "EDITOU", id, `Editou os dados da admissão de ${lido.dados.nome}.`);
  refresh(a.companyId, id);
  return { ok: true };
}

/** Marca que a mensagem saiu: ao médico ou, com o link, ao funcionário. */
export async function marcarEnvio(id: string, para: "medico" | "funcionario"): Promise<AdmissaoState> {
  await requireSession();
  const a = await prisma.admissao.findUnique({ where: { id }, select: { companyId: true } });
  if (!a) return { error: "Admissão não encontrada." };
  await prisma.admissao.update({
    where: { id },
    data: para === "medico" ? { enviadoAoMedicoEm: new Date() } : { linkEnviadoEm: new Date() },
  });
  refresh(a.companyId, id);
  return { ok: true };
}

export async function marcarPacoteGerado(id: string): Promise<AdmissaoState> {
  await requireSession();
  const a = await prisma.admissao.findUnique({ where: { id }, select: { companyId: true } });
  if (!a) return { error: "Admissão não encontrada." };
  await prisma.admissao.update({ where: { id }, data: { pacoteGeradoEm: new Date() } });
  refresh(a.companyId, id);
  return { ok: true };
}

export async function anexarArquivo(formData: FormData): Promise<AdmissaoState> {
  const session = await requireSession();
  const id = String(formData.get("admissaoId") ?? "");
  const a = await prisma.admissao.findUnique({ where: { id }, select: { companyId: true, nome: true } });
  if (!a) return { error: "Admissão não encontrada." };
  const tipo = String(formData.get("tipo") ?? "");
  const r = await guardarArquivo(id, tipo, formData.get("arquivo"), session.name);
  if (r.error) return r;
  await log(a.companyId, session.userId, "EDITOU", id, `Anexou ${documentoDaChave(tipo)?.nome ?? "documento"} na admissão de ${a.nome}.`);
  refresh(a.companyId, id);
  return { ok: true };
}

/**
 * Apaga um arquivo. Só pelo botão com confirmação, e fica no Fluxo de
 * atividades quem apagou e o quê.
 */
export async function excluirArquivo(arquivoId: string): Promise<AdmissaoState> {
  const session = await requireSession();
  const d = await prisma.documentoDaAdmissao.findUnique({
    where: { id: arquivoId },
    select: { tipo: true, nome: true, admissao: { select: { id: true, companyId: true, nome: true } } },
  });
  if (!d) return { error: "Arquivo não encontrado." };
  await prisma.documentoDaAdmissao.delete({ where: { id: arquivoId } });
  await log(
    d.admissao.companyId,
    session.userId,
    "EXCLUIU",
    d.admissao.id,
    `Apagou o arquivo "${d.nome}" (${documentoDaChave(d.tipo)?.nome ?? d.tipo}) da admissão de ${d.admissao.nome}.`,
  );
  refresh(d.admissao.companyId, d.admissao.id);
  return { ok: true };
}

/** Cria a ficha do funcionário na Equipe da empresa, com os dados daqui. */
export async function criarNaEquipe(id: string): Promise<AdmissaoState> {
  const session = await requireSession();
  const a = await prisma.admissao.findUnique({ where: { id } });
  if (!a) return { error: "Admissão não encontrada." };
  if (a.employeeId) return { error: "A ficha na Equipe já foi criada." };

  const cargo = await prisma.cargo.findFirst({
    where: { companyId: a.companyId, nome: { equals: a.funcao, mode: "insensitive" } },
    select: { id: true, nome: true },
  });

  const pessoa = await prisma.employee.create({
    data: {
      companyId: a.companyId,
      name: a.nome,
      document: a.cpf,
      role: cargo?.nome ?? a.funcao,
      cargoId: cargo?.id ?? null,
      phone: a.telefone,
      birthDate: a.dataNascimento,
      hiredAt: a.dataAdmissao,
    },
    select: { id: true },
  });
  await prisma.admissao.update({ where: { id }, data: { employeeId: pessoa.id } });
  await log(a.companyId, session.userId, "CRIOU", pessoa.id, `Cadastrou ${a.nome} na Equipe pela admissão.`);
  refresh(a.companyId, id);
  revalidatePath(`/empresas/${a.companyId}/equipe`);
  return { ok: true };
}

/** Só sai a admissão que ainda não tem arquivo: documento enviado não se apaga junto. */
export async function excluirAdmissao(id: string): Promise<AdmissaoState> {
  const session = await requireSession();
  const a = await prisma.admissao.findUnique({
    where: { id },
    select: { companyId: true, nome: true, _count: { select: { documentos: true } } },
  });
  if (!a) return { error: "Admissão não encontrada." };
  if (a._count.documentos > 0) return { error: "Esta admissão já tem documentos enviados e não pode ser apagada." };
  await prisma.admissao.delete({ where: { id } });
  await log(a.companyId, session.userId, "EXCLUIU", id, `Apagou a admissão de ${a.nome}, que não tinha documentos.`);
  refresh(a.companyId);
  redirect("/admissoes");
}

/** Depois do pacote o link fecha; reabre para o funcionário mandar o que faltou. */
export async function reabrirLink(id: string): Promise<AdmissaoState> {
  await requireSession();
  const a = await prisma.admissao.findUnique({ where: { id }, select: { companyId: true } });
  if (!a) return { error: "Admissão não encontrada." };
  await prisma.admissao.update({ where: { id }, data: { pacoteGeradoEm: null, documentosEnviadosEm: null } });
  refresh(a.companyId, id);
  return { ok: true };
}
