"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { textoSeguro } from "@/lib/texto-seguro";
import { lerEstrutura, lerTesteCadastrado, type ModoDoTeste } from "@/lib/testes-cadastrados";

/**
 * A aba Testes: os testes da consultoria (o DISC e os cadastrados por ela) e
 * os envios. Cada envio é um link para uma pessoa responder; a resposta volta
 * para cá já apurada.
 */

export type TestesState = { error?: string; erros?: string[]; ok?: boolean; id?: string; token?: string };

function refresh(id?: string) {
  revalidatePath("/testes");
  revalidatePath("/selecao", "layout");
  if (id) revalidatePath(`/testes/${id}`);
}

// ------------------------------------------------------------------ enviar

/**
 * Cria o link de um teste para uma pessoa. O teste cadastrado vai copiado no
 * envio: editar o cadastro depois não muda o que esta pessoa responde.
 *
 * É o mesmo envio feito pela aba Testes e pelo quadro da vaga na Seleção —
 * este, com o candidato ligado, para a vaga saber que está esperando resposta.
 */
async function criarEnvio(d: {
  teste: string;
  pessoa: string;
  telefone: string | null;
  companyId: string | null;
  candidateId: string | null;
  enviadoPor: string;
}): Promise<TestesState> {
  if (d.pessoa.length < 2) return { error: "Diga o nome de quem vai responder." };
  if (!d.teste) return { error: "Escolha o teste." };

  if (d.companyId) {
    const existe = await prisma.company.count({ where: { id: d.companyId } });
    if (!existe) return { error: "Empresa não encontrada." };
  }

  let dados: { tipo: string; nomeDoTeste: string; customTestId: string | null; estrutura?: object };
  if (d.teste === "DISC") {
    dados = { tipo: "DISC", nomeDoTeste: "Perfil comportamental (DISC)", customTestId: null };
  } else {
    const cadastrado = await prisma.customTest.findUnique({ where: { id: d.teste } });
    if (!cadastrado || !cadastrado.active) return { error: "Esse teste não está disponível." };
    const copia = lerTesteCadastrado({
      nome: cadastrado.name,
      instrucoes: cadastrado.instructions,
      modo: cadastrado.mode,
      fatores: cadastrado.factors,
      pares: cadastrado.pairs,
      questoes: cadastrado.questions,
    });
    if (!copia) return { error: "Esse teste está sem questões. Abra o cadastro e confira." };
    dados = { tipo: "CADASTRADO", nomeDoTeste: cadastrado.name, customTestId: cadastrado.id, estrutura: copia };
  }

  const token = randomBytes(24).toString("hex");
  const envio = await prisma.testeEnviado.create({
    data: {
      ...dados,
      token,
      pessoa: d.pessoa.slice(0, 120),
      telefone: d.telefone,
      companyId: d.companyId,
      candidateId: d.candidateId,
      enviadoPor: d.enviadoPor,
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, id: envio.id, token };
}

export async function enviarTeste(_prev: TestesState, formData: FormData): Promise<TestesState> {
  const session = await requireSession();
  return criarEnvio({
    teste: String(formData.get("teste") ?? ""),
    pessoa: textoSeguro(String(formData.get("pessoa") ?? "")).trim(),
    telefone: String(formData.get("telefone") ?? "").replace(/\D/g, "") || null,
    companyId: String(formData.get("companyId") ?? "") || null,
    candidateId: null,
    enviadoPor: session.name,
  });
}

/**
 * Manda um teste ao candidato de uma vaga, direto do quadro da Seleção. O
 * nome, o telefone e a empresa vêm do candidato; a vaga passa a mostrar que
 * está esperando a resposta, e o resultado aparece no cartão dele.
 */
export async function enviarTesteAoCandidato(candidatoId: string, teste: string): Promise<TestesState> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({
    where: { id: candidatoId },
    select: { name: true, phone: true, companyId: true },
  });
  if (!c) return { error: "Candidato não encontrado." };
  return criarEnvio({
    teste,
    pessoa: c.name,
    telefone: (c.phone ?? "").replace(/\D/g, "") || null,
    companyId: c.companyId,
    candidateId: candidatoId,
    enviadoPor: session.name,
  });
}

export async function excluirEnvio(id: string): Promise<TestesState> {
  await requireSession();
  await prisma.testeEnviado.deleteMany({ where: { id } });
  refresh();
  return { ok: true };
}

// --------------------------------------------------------------- cadastro

export async function salvarTesteCadastrado(_prev: TestesState, formData: FormData): Promise<TestesState> {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  const nome = textoSeguro(String(formData.get("nome") ?? "")).trim();
  const instrucoes = textoSeguro(String(formData.get("instrucoes") ?? "")).trim();
  const modo: ModoDoTeste = formData.get("modo") === "NOTAS" ? "NOTAS" : "ESCOLHA";
  const texto = textoSeguro(String(formData.get("estrutura") ?? ""));

  if (nome.length < 2) return { error: "Dê um nome ao teste." };

  const { estrutura, erros } = lerEstrutura(texto);
  if (erros.length > 0) {
    return { error: "A estrutura tem pontos a corrigir antes de salvar.", erros: erros.slice(0, 30) };
  }

  const dados = {
    name: nome.slice(0, 120),
    instructions: instrucoes ? instrucoes.slice(0, 4_000) : null,
    mode: modo,
    factors: estrutura.fatores,
    pairs: estrutura.pares,
    questions: estrutura.questoes,
  };

  let salvo = id;
  if (id) {
    const { count } = await prisma.customTest.updateMany({ where: { id }, data: dados });
    if (count === 0) return { error: "Teste não encontrado." };
  } else {
    const criado = await prisma.customTest.create({
      data: { ...dados, createdById: session.userId },
      select: { id: true },
    });
    salvo = criado.id;
  }

  refresh(salvo);
  return { ok: true, id: salvo };
}

/** Ativo aparece para enviar; desativado some da lista, sem perder o que já foi respondido. */
export async function alternarTesteCadastrado(id: string, ativo: boolean): Promise<TestesState> {
  await requireSession();
  await prisma.customTest.updateMany({ where: { id }, data: { active: ativo } });
  refresh(id);
  return { ok: true };
}

/** Exclui o cadastro. As respostas ficam: cada envio guardou a sua cópia do teste. */
export async function excluirTesteCadastrado(id: string): Promise<TestesState> {
  await requireSession();
  await prisma.customTest.deleteMany({ where: { id } });
  refresh();
  return { ok: true };
}
