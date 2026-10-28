"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { apagarComPermissao } from "@/lib/respostas-protegidas-dados";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido } from "@/lib/agenda";
import { dayKeyToDate } from "@/lib/dates";
import { textoDoFormulario } from "@/lib/texto-seguro";
import { lerPerguntas } from "@/lib/entrevista";
import { lerTipoDeCompetencia } from "@/lib/pdi";
import {
  CAMPOS_DA_ESPECIFICACAO,
  lerEspecificacao,
  lerNivelDeCargo,
  lerRespostas,
  lerResponsabilidades,
  questionarioEmTexto,
} from "@/lib/cargos";
import { rascunharDescricao, sugerirPerguntas } from "@/lib/ai-cargos";

/**
 * A aba Cargos: a descrição do cargo, o questionário de cargo mandado por link
 * e o roteiro de entrevista. Criar, renomear e excluir o cargo ficam nas ações
 * de Treinamentos, que já cuidam das pessoas e da matriz.
 */

/** `respostas`: o que se perde respondido por link; a tela pergunta e chama de novo. */
export type CargoState = { error?: string; ok?: boolean; id?: string; token?: string; respostas?: string };

const log = atividade("CARGO");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
}

function texto(valor: FormDataEntryValue | string | null | undefined, max = 4000): string | null {
  return textoDoFormulario(valor, max) || null;
}

async function cargoDe(cargoId: string) {
  return prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true } });
}

// ---------------------------------------------------------------- descrição

export async function mudarNivel(cargoId: string, nivel: string): Promise<CargoState> {
  const session = await requireSession();
  const cargo = await cargoDe(cargoId);
  if (!cargo) return { error: "Cargo não encontrado." };
  const lido = lerNivelDeCargo(nivel);
  if (!lido) return { error: "Escolha o nível do cargo." };
  await prisma.cargo.update({ where: { id: cargoId }, data: { nivel: lido } });
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Mudou o nível do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

export async function salvarDescricao(_prev: CargoState, formData: FormData): Promise<CargoState> {
  const session = await requireSession();
  const cargoId = String(formData.get("cargoId") ?? "");
  const cargo = await cargoDe(cargoId);
  if (!cargo) return { error: "Cargo não encontrado." };

  const especificacao = lerEspecificacao(
    Object.fromEntries(CAMPOS_DA_ESPECIFICACAO.map(({ chave }) => [chave, String(formData.get(`esp_${chave}`) ?? "")])),
  );
  const responsabilidades = lerResponsabilidades(texto(formData.get("responsabilidades"), 12000)).join("\n");

  await prisma.cargo.update({
    where: { id: cargoId },
    data: {
      setor: texto(formData.get("setor"), 200),
      cbo: texto(formData.get("cbo"), 20),
      superior: texto(formData.get("superior"), 200),
      subordinados: texto(formData.get("subordinados"), 500),
      missao: texto(formData.get("missao")),
      responsabilidades: responsabilidades || null,
      requisitos: texto(formData.get("requisitos")),
      especificacao,
    },
  });
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Atualizou a descrição do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

export async function aprovarDescricao(cargoId: string): Promise<CargoState> {
  const session = await requireSession();
  const cargo = await prisma.cargo.findUnique({
    where: { id: cargoId },
    select: { companyId: true, nome: true, missao: true, responsabilidades: true },
  });
  if (!cargo) return { error: "Cargo não encontrado." };
  if (!cargo.missao || !cargo.responsabilidades) return { error: "Escreva a missão e as responsabilidades antes de aprovar." };
  await prisma.cargo.update({ where: { id: cargoId }, data: { aprovadaEm: new Date() } });
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Aprovou a descrição do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

/**
 * O rascunho da descrição pela IA, a partir dos questionários respondidos.
 *
 * Preenche os campos e inclui as competências que o cargo ainda não tem; não
 * apaga competência nenhuma, porque as avaliações de PDI dependem delas. A
 * aprovação volta a ficar pendente até a consultora revisar.
 */
export async function gerarDescricao(cargoId: string): Promise<CargoState> {
  const session = await requireSession();
  const cargo = await prisma.cargo.findUnique({
    where: { id: cargoId },
    select: {
      companyId: true,
      nome: true,
      nivel: true,
      company: { select: { valores: true } },
      competencias: { select: { nome: true } },
      questionarios: { where: { status: "RESPONDIDO" }, orderBy: { respondidoEm: "asc" }, select: { nivel: true, respostas: true } },
    },
  });
  if (!cargo) return { error: "Cargo não encontrado." };
  if (cargo.questionarios.length === 0) return { error: "Ainda não há questionário respondido para este cargo." };

  const nivel = lerNivelDeCargo(cargo.nivel) ?? lerNivelDeCargo(cargo.questionarios[0].nivel)!;
  const textos = cargo.questionarios.map((q) => {
    const n = lerNivelDeCargo(q.nivel) ?? nivel;
    return questionarioEmTexto(n, lerRespostas(n, q.respostas));
  });

  let d;
  try {
    d = await rascunharDescricao(cargo.nome, nivel, textos, cargo.company.valores ?? "");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "A IA não conseguiu montar a descrição." };
  }
  if (!d.missao && d.responsabilidades.length === 0) return { error: "A IA devolveu uma descrição vazia. Tente de novo." };

  const jaTem = new Set(cargo.competencias.map((c) => c.nome.toLowerCase()));
  const novas = d.competencias.filter((c) => !jaTem.has(c.nome.toLowerCase()));

  await prisma.$transaction([
    prisma.cargo.update({
      where: { id: cargoId },
      data: {
        ...(d.setor ? { setor: d.setor } : {}),
        ...(d.cbo ? { cbo: d.cbo } : {}),
        ...(d.superior ? { superior: d.superior } : {}),
        ...(d.subordinados ? { subordinados: d.subordinados } : {}),
        missao: d.missao || null,
        responsabilidades: d.responsabilidades.join("\n") || null,
        requisitos: d.requisitos || null,
        especificacao: d.especificacao,
        aprovadaEm: null,
      },
    }),
    prisma.competenciaDoCargo.createMany({
      data: novas.map((c, i) => ({
        cargoId,
        nome: c.nome,
        tipo: c.tipo,
        descricao: c.descricao || null,
        nivelEsperado: c.nivelEsperado,
        ordem: cargo.competencias.length + i,
      })),
    }),
  ]);
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Gerou com IA o rascunho da descrição do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ questionários

export async function enviarQuestionario(_prev: CargoState, formData: FormData): Promise<CargoState> {
  const session = await requireSession();
  const cargoId = String(formData.get("cargoId") ?? "");
  const pessoa = texto(formData.get("pessoa"), 120);
  const prazoCru = String(formData.get("prazo") ?? "").trim();
  if (!pessoa || pessoa.length < 2) return { error: "Diga quem vai responder." };
  if (prazoCru && !diaValido(prazoCru)) return { error: "Data de prazo inválida." };

  const cargo = await prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true, nivel: true } });
  if (!cargo) return { error: "Cargo não encontrado." };
  const nivel = lerNivelDeCargo(cargo.nivel);
  if (!nivel) return { error: "Escolha o nível do cargo antes de mandar o questionário." };

  const token = randomBytes(24).toString("hex");
  const enviado = await prisma.questionarioDeCargo.create({
    data: {
      token,
      cargoId,
      nivel,
      pessoa,
      prazo: prazoCru ? dayKeyToDate(prazoCru) : null,
      enviadoPor: session.userId,
    },
    select: { id: true },
  });
  await log(cargo.companyId, session.userId, "CRIOU", enviado.id, `Gerou o questionário do cargo ${cargo.nome} para ${pessoa}.`);
  refresh(cargo.companyId);
  return { ok: true, id: enviado.id, token };
}

export async function excluirQuestionario(questionarioId: string, apagarRespostas = false): Promise<CargoState> {
  const session = await requireSession();
  const q = await prisma.questionarioDeCargo.findUnique({
    where: { id: questionarioId },
    select: { pessoa: true, status: true, cargo: { select: { companyId: true, nome: true } } },
  });
  if (!q) return { error: "Questionário não encontrado." };
  if (q.status === "RESPONDIDO" && !apagarRespostas) return { respostas: `o questionário que ${q.pessoa} respondeu` };
  await apagarComPermissao([prisma.questionarioDeCargo.delete({ where: { id: questionarioId } })]);
  await log(q.cargo.companyId, session.userId, "EXCLUIU", questionarioId, `Excluiu o questionário de ${q.pessoa} (${q.cargo.nome}).`);
  refresh(q.cargo.companyId);
  return { ok: true };
}

/** Devolve o link para a pessoa corrigir alguma resposta. */
export async function reabrirQuestionario(questionarioId: string): Promise<CargoState> {
  const session = await requireSession();
  const q = await prisma.questionarioDeCargo.findUnique({
    where: { id: questionarioId },
    select: { pessoa: true, cargo: { select: { companyId: true, nome: true } } },
  });
  if (!q) return { error: "Questionário não encontrado." };
  await prisma.questionarioDeCargo.update({ where: { id: questionarioId }, data: { status: "ENVIADO", respondidoEm: null } });
  await log(q.cargo.companyId, session.userId, "ATUALIZOU", questionarioId, `Reabriu o questionário de ${q.pessoa} (${q.cargo.nome}).`);
  refresh(q.cargo.companyId);
  return { ok: true };
}

// ---------------------------------------------------------------- entrevista

export async function salvarPerguntas(cargoId: string, perguntas: string): Promise<CargoState> {
  const session = await requireSession();
  const cargo = await cargoDe(cargoId);
  if (!cargo) return { error: "Cargo não encontrado." };
  const lidas = lerPerguntas(perguntas);
  await prisma.cargo.update({ where: { id: cargoId }, data: { perguntasDaEntrevista: lidas } });
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Atualizou a entrevista do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

/** Sugestões da IA a partir da descrição. Não grava: voltam para a tela, e ela escolhe. */
export async function sugerirPerguntasDoCargo(cargoId: string): Promise<CargoState & { perguntas?: string[] }> {
  await requireSession();
  const cargo = await prisma.cargo.findUnique({
    where: { id: cargoId },
    select: {
      nome: true,
      missao: true,
      responsabilidades: true,
      requisitos: true,
      competencias: { orderBy: { ordem: "asc" }, select: { nome: true, tipo: true, descricao: true } },
    },
  });
  if (!cargo) return { error: "Cargo não encontrado." };
  if (!cargo.missao && !cargo.responsabilidades && cargo.competencias.length === 0)
    return { error: "Escreva a descrição do cargo primeiro: as perguntas saem dela." };

  try {
    const perguntas = await sugerirPerguntas({
      nome: cargo.nome,
      missao: cargo.missao ?? "",
      responsabilidades: lerResponsabilidades(cargo.responsabilidades),
      requisitos: cargo.requisitos ?? "",
      competencias: cargo.competencias.map((c) => ({
        nome: c.nome,
        tipo: lerTipoDeCompetencia(c.tipo),
        descricao: c.descricao ?? "",
      })),
    });
    if (perguntas.length === 0) return { error: "A IA não sugeriu nenhuma pergunta. Tente de novo." };
    return { ok: true, perguntas };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "A IA não conseguiu sugerir perguntas." };
  }
}
