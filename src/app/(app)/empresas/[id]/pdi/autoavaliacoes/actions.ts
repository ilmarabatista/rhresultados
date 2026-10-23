"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido } from "@/lib/agenda";
import { dateToDayKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { textoDoFormulario } from "@/lib/texto-seguro";
import { novoToken, perguntasParaEnviar } from "@/lib/autoavaliacao-envio";
import { foraDoPdi } from "@/lib/prestadores";
import {
  camposAbertos,
  INSTRUCOES_PADRAO,
  lerDestino,
  lerPerguntas,
  lerRespostas,
  lerTipoDePergunta,
  notasDaAutoavaliacao,
} from "@/lib/autoavaliacao";

/**
 * Autoavaliação do PDI: os modelos de cada função, com as perguntas que a
 * empresa monta; o envio por link a cada pessoa; e a passagem das respostas
 * para a avaliação do PDI.
 */

export type AutoavaliacaoState = { error?: string; ok?: boolean; id?: string; token?: string };

const log = atividade("PDI");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
}

function texto(valor: FormDataEntryValue | string | null | undefined, max = 4000): string | null {
  return textoDoFormulario(valor, max) || null;
}

// ------------------------------------------------------------------ modelos

export async function salvarModelo(_prev: AutoavaliacaoState, formData: FormData): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const id = String(formData.get("modeloId") ?? "") || null;
  const nome = texto(formData.get("nome"), 120);
  const cargoId = String(formData.get("cargoId") ?? "") || null;
  if (!nome || nome.length < 2) return { error: "Dê o nome da função." };

  if (cargoId) {
    const cargo = await prisma.cargo.findFirst({ where: { id: cargoId, companyId }, select: { id: true } });
    if (!cargo) return { error: "Cargo não encontrado." };
  }
  const dados = { nome, cargoId, instrucoes: texto(formData.get("instrucoes")) };

  if (id) {
    const { count } = await prisma.modeloDeAutoavaliacao.updateMany({ where: { id, companyId }, data: dados });
    if (count === 0) return { error: "Modelo não encontrado." };
    refresh(companyId);
    return { ok: true, id };
  }
  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!empresa) return { error: "Empresa não encontrada." };
  const modelo = await prisma.modeloDeAutoavaliacao.create({
    data: { ...dados, companyId, instrucoes: dados.instrucoes ?? INSTRUCOES_PADRAO },
    select: { id: true },
  });
  await log(companyId, session.userId, "CRIOU", modelo.id, `Criou o modelo de autoavaliação ${nome}.`);
  refresh(companyId);
  return { ok: true, id: modelo.id };
}

/** Uma cópia do modelo, com todas as perguntas: o ponto de partida de outra função. */
export async function duplicarModelo(modeloId: string): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const m = await prisma.modeloDeAutoavaliacao.findUnique({
    where: { id: modeloId },
    include: { perguntas: { orderBy: { ordem: "asc" } } },
  });
  if (!m) return { error: "Modelo não encontrado." };
  const copia = await prisma.modeloDeAutoavaliacao.create({
    data: {
      companyId: m.companyId,
      nome: `${m.nome} (cópia)`,
      instrucoes: m.instrucoes,
      perguntas: {
        create: m.perguntas.map((p) => ({ tipo: p.tipo, texto: p.texto, destino: p.destino, ordem: p.ordem })),
      },
    },
    select: { id: true },
  });
  await log(m.companyId, session.userId, "CRIOU", copia.id, `Duplicou o modelo de autoavaliação ${m.nome}.`);
  refresh(m.companyId);
  return { ok: true, id: copia.id };
}

export async function excluirModelo(modeloId: string): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const m = await prisma.modeloDeAutoavaliacao.findUnique({ where: { id: modeloId }, select: { companyId: true, nome: true } });
  if (!m) return { ok: true };
  // As autoavaliações já mandadas guardam a cópia das perguntas e continuam.
  await prisma.modeloDeAutoavaliacao.delete({ where: { id: modeloId } });
  await log(m.companyId, session.userId, "EXCLUIU", modeloId, `Excluiu o modelo de autoavaliação ${m.nome}.`);
  refresh(m.companyId);
  return { ok: true };
}

// ---------------------------------------------------------------- perguntas

async function empresaDoModelo(modeloId: string) {
  const m = await prisma.modeloDeAutoavaliacao.findUnique({ where: { id: modeloId }, select: { companyId: true } });
  return m?.companyId ?? null;
}

export async function salvarPergunta(_prev: AutoavaliacaoState, formData: FormData): Promise<AutoavaliacaoState> {
  await requireSession();
  const modeloId = String(formData.get("modeloId") ?? "");
  const id = String(formData.get("perguntaId") ?? "") || null;
  const tipo = lerTipoDePergunta(formData.get("tipo"));
  const textoDaPergunta = texto(formData.get("texto"), 500);
  if (!tipo) return { error: "Escolha o tipo da pergunta." };
  if (!textoDaPergunta || textoDaPergunta.length < 2) return { error: "Escreva a pergunta." };
  const destino = tipo === "ABERTA" ? (lerDestino(formData.get("destino")) ?? "querDesenvolver") : null;

  const companyId = await empresaDoModelo(modeloId);
  if (!companyId) return { error: "Modelo não encontrado." };

  if (id) {
    const { count } = await prisma.perguntaDeAutoavaliacao.updateMany({
      where: { id, modeloId },
      data: { tipo, texto: textoDaPergunta, destino },
    });
    if (count === 0) return { error: "Pergunta não encontrada." };
  } else {
    // Entra no fim da própria seção.
    const ultima = await prisma.perguntaDeAutoavaliacao.aggregate({ where: { modeloId }, _max: { ordem: true } });
    await prisma.perguntaDeAutoavaliacao.create({
      data: { modeloId, tipo, texto: textoDaPergunta, destino, ordem: (ultima._max.ordem ?? -1) + 1 },
    });
  }
  await prisma.modeloDeAutoavaliacao.update({ where: { id: modeloId }, data: { updatedAt: new Date() } });
  refresh(companyId);
  return { ok: true };
}

export async function excluirPergunta(perguntaId: string): Promise<AutoavaliacaoState> {
  await requireSession();
  const p = await prisma.perguntaDeAutoavaliacao.findUnique({
    where: { id: perguntaId },
    select: { modelo: { select: { companyId: true } } },
  });
  if (!p) return { ok: true };
  await prisma.perguntaDeAutoavaliacao.delete({ where: { id: perguntaId } });
  refresh(p.modelo.companyId);
  return { ok: true };
}

/** Sobe ou desce a pergunta dentro da seção dela. */
export async function moverPergunta(perguntaId: string, direcao: -1 | 1): Promise<AutoavaliacaoState> {
  await requireSession();
  const p = await prisma.perguntaDeAutoavaliacao.findUnique({
    where: { id: perguntaId },
    select: { modeloId: true, tipo: true, modelo: { select: { companyId: true } } },
  });
  if (!p) return { error: "Pergunta não encontrada." };
  const daSecao = await prisma.perguntaDeAutoavaliacao.findMany({
    where: { modeloId: p.modeloId, tipo: p.tipo },
    orderBy: [{ ordem: "asc" }, { id: "asc" }],
    select: { id: true, ordem: true },
  });
  const i = daSecao.findIndex((x) => x.id === perguntaId);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= daSecao.length) return { ok: true };
  const [a, b] = [daSecao[i], daSecao[j]];
  // Ordens iguais (de cópias antigas) não trocariam nada: usa a posição.
  const [oa, ob] = a.ordem === b.ordem ? [j, i] : [b.ordem, a.ordem];
  await prisma.$transaction([
    prisma.perguntaDeAutoavaliacao.update({ where: { id: a.id }, data: { ordem: oa } }),
    prisma.perguntaDeAutoavaliacao.update({ where: { id: b.id }, data: { ordem: ob } }),
  ]);
  refresh(p.modelo.companyId);
  return { ok: true };
}

// ------------------------------------------------------------------- envio

/** Gera o link da pessoa, com uma cópia das perguntas do modelo naquele dia. */
export async function enviarAutoavaliacao(_prev: AutoavaliacaoState, formData: FormData): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "");
  const modeloId = String(formData.get("modeloId") ?? "");
  const prazoCru = String(formData.get("prazo") ?? "").trim();
  if (!modeloId) return { error: "Escolha o modelo de autoavaliação." };
  if (prazoCru && !diaValido(prazoCru)) return { error: "Data de prazo inválida." };

  const pessoa = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true, name: true, role: true } });
  if (!pessoa) return { error: "Pessoa não encontrada." };
  if (foraDoPdi(pessoa.role)) return { error: "Dentistas e laboratório não fazem autoavaliação." };
  const modelo = await prisma.modeloDeAutoavaliacao.findFirst({
    where: { id: modeloId, companyId: pessoa.companyId },
    include: { perguntas: true },
  });
  if (!modelo) return { error: "Modelo não encontrado." };
  if (modelo.perguntas.length === 0) return { error: "O modelo ainda não tem perguntas." };

  const token = novoToken();
  const enviada = await prisma.autoavaliacao.create({
    data: {
      token,
      employeeId,
      modeloId,
      titulo: modelo.nome,
      instrucoes: modelo.instrucoes,
      perguntas: perguntasParaEnviar(modelo.perguntas),
      prazo: prazoCru ? dayKeyToDate(prazoCru) : null,
      enviadoPor: session.userId,
    },
    select: { id: true },
  });
  await log(pessoa.companyId, session.userId, "CRIOU", employeeId, `Gerou o link da autoavaliação (${modelo.nome}) de ${pessoa.name}.`);
  refresh(pessoa.companyId);
  return { ok: true, id: enviada.id, token };
}

/**
 * Gera de uma vez os links de várias pessoas, cada uma com o modelo escolhido
 * para ela. Quem já tem link aberto ou respondido fica de fora: o link dela
 * continua o mesmo.
 */
export async function gerarLinks(
  companyId: string,
  pedidos: { employeeId: string; modeloId: string }[],
  prazo: string,
): Promise<AutoavaliacaoState & { gerados?: number }> {
  const session = await requireSession();
  if (prazo && !diaValido(prazo)) return { error: "Data de prazo inválida." };
  const validos = pedidos.filter((p) => p.employeeId && p.modeloId).slice(0, 300);
  if (validos.length === 0) return { error: "Escolha o modelo de cada pessoa." };

  const [pessoas, modelos] = await Promise.all([
    prisma.employee.findMany({
      where: {
        companyId,
        id: { in: validos.map((p) => p.employeeId) },
        status: { not: "DESLIGADO" },
        autoavaliacoes: { none: {} },
      },
      select: { id: true, role: true },
    }),
    prisma.modeloDeAutoavaliacao.findMany({
      where: { companyId, id: { in: validos.map((p) => p.modeloId) } },
      include: { perguntas: true },
    }),
  ]);
  const semLink = new Set(pessoas.filter((p) => !foraDoPdi(p.role)).map((p) => p.id));
  const porId = new Map(modelos.filter((m) => m.perguntas.length > 0).map((m) => [m.id, m]));

  const dados = validos.flatMap((p) => {
    const modelo = porId.get(p.modeloId);
    if (!semLink.has(p.employeeId) || !modelo) return [];
    semLink.delete(p.employeeId);
    return [
      {
        token: novoToken(),
        employeeId: p.employeeId,
        modeloId: modelo.id,
        titulo: modelo.nome,
        instrucoes: modelo.instrucoes,
        perguntas: perguntasParaEnviar(modelo.perguntas),
        prazo: prazo ? dayKeyToDate(prazo) : null,
        enviadoPor: session.userId,
      },
    ];
  });
  if (dados.length === 0) return { error: "Ninguém da lista está sem link." };
  await prisma.autoavaliacao.createMany({ data: dados });
  await log(companyId, session.userId, "CRIOU", companyId, `Gerou ${dados.length} link(s) de autoavaliação.`);
  refresh(companyId);
  return { ok: true, gerados: dados.length };
}

async function carregarEnvio(autoId: string) {
  return prisma.autoavaliacao.findUnique({
    where: { id: autoId },
    select: {
      id: true,
      status: true,
      titulo: true,
      perguntas: true,
      respostas: true,
      respondidoEm: true,
      avaliacaoId: true,
      employeeId: true,
      employee: { select: { companyId: true, name: true, cargo: { select: { id: true, nome: true } } } },
    },
  });
}

export async function excluirAutoavaliacao(autoId: string): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const a = await carregarEnvio(autoId);
  if (!a) return { ok: true };
  // A avaliação que saiu dela fica: o RH já pode ter dado as notas dele.
  await prisma.autoavaliacao.delete({ where: { id: autoId } });
  await log(a.employee.companyId, session.userId, "EXCLUIU", a.employeeId, `Excluiu a autoavaliação (${a.titulo}) de ${a.employee.name}.`);
  refresh(a.employee.companyId);
  return { ok: true };
}

/** Devolve o link para a pessoa corrigir. A avaliação já montada não muda. */
export async function reabrirAutoavaliacao(autoId: string): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const a = await carregarEnvio(autoId);
  if (!a) return { error: "Autoavaliação não encontrada." };
  await prisma.autoavaliacao.update({ where: { id: autoId }, data: { status: "ENVIADO", respondidoEm: null } });
  await log(a.employee.companyId, session.userId, "ATUALIZOU", a.employeeId, `Reabriu a autoavaliação de ${a.employee.name}.`);
  refresh(a.employee.companyId);
  return { ok: true };
}

/**
 * Monta a avaliação do PDI a partir das respostas: cada marcação vira um item
 * com a nota da pessoa, e as abertas vão para a conversa. O RH completa a nota
 * dele e a acordada na grade, e dali sai o plano.
 */
export async function levarParaAvaliacao(autoId: string): Promise<AutoavaliacaoState> {
  const session = await requireSession();
  const a = await carregarEnvio(autoId);
  if (!a) return { error: "Autoavaliação não encontrada." };
  if (a.status !== "RESPONDIDO") return { error: "A pessoa ainda não respondeu." };
  if (a.avaliacaoId) return { ok: true, id: a.avaliacaoId };

  const perguntas = lerPerguntas(a.perguntas);
  const respostas = lerRespostas(perguntas, a.respostas);
  const notas = notasDaAutoavaliacao(perguntas, respostas);
  const abertos = camposAbertos(perguntas, respostas);

  const avaliacao = await prisma.avaliacaoDeCompetencias.create({
    data: {
      employeeId: a.employeeId,
      cargoId: a.employee.cargo?.id ?? null,
      cargoNome: a.employee.cargo?.nome ?? a.titulo,
      data: dayKeyToDate(a.respondidoEm ? dateToDayKey(a.respondidoEm) : todayKey()),
      createdById: session.userId,
      ...abertos,
      notas: { create: notas.map((n, ordem) => ({ ...n, ordem })) },
    },
    select: { id: true },
  });
  // Dois cliques ao mesmo tempo: fica a avaliação de quem chegou primeiro.
  const { count } = await prisma.autoavaliacao.updateMany({ where: { id: a.id, avaliacaoId: null }, data: { avaliacaoId: avaliacao.id } });
  if (count === 0) {
    await prisma.avaliacaoDeCompetencias.delete({ where: { id: avaliacao.id } });
    const atual = await prisma.autoavaliacao.findUnique({ where: { id: a.id }, select: { avaliacaoId: true } });
    return { ok: true, id: atual?.avaliacaoId ?? undefined };
  }

  await log(a.employee.companyId, session.userId, "CRIOU", a.employeeId, `Montou a avaliação do PDI de ${a.employee.name} a partir da autoavaliação.`);
  refresh(a.employee.companyId);
  return { ok: true, id: avaliacao.id };
}
