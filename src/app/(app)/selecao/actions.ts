"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { textoSeguro } from "@/lib/texto-seguro";
import { atividade } from "@/lib/atividade";
import { MODELO_SUGERIDO, tipoValido, type EtapaTipo } from "@/lib/selecao";

/**
 * O processo seletivo: modelos de processo, vagas, etapas e candidatos.
 *
 * Três regras valem em tudo o que está aqui:
 *
 * 1. As etapas da vaga são cópias do modelo. Editar o modelo não mexe em vaga
 *    aberta, e editar a vaga não mexe no modelo.
 * 2. Todo movimento do candidato vira histórico (`MovimentoDoCandidato`), com o
 *    nome da etapa do dia e o motivo. É de lá que saem o funil e a ficha.
 * 3. Quem sai do processo não é apagado: fica com a situação e espera o
 *    retorno, que também é registrado.
 */

export type SelecaoState = { error?: string; ok?: boolean; id?: string };

const registrar = atividade("SELECAO");

/**
 * O histórico de atividades é por empresa. O que não tem empresa — os modelos
 * de processo, o candidato ainda sem vaga — simplesmente não entra lá.
 */
async function log(companyId: string | null | undefined, ...resto: [string, string, string, string]) {
  if (!companyId) return;
  await registrar(companyId, ...resto);
}

function refresh(companyId?: string | null) {
  revalidatePath("/selecao", "layout");
  revalidatePath("/inicio");
  if (companyId) revalidatePath(`/empresas/${companyId}`, "layout");
}

function texto(v: FormDataEntryValue | null): string {
  return textoSeguro(String(v ?? "")).trim();
}

function numero(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function tipoDoForm(v: FormDataEntryValue | null): EtapaTipo {
  const t = String(v ?? "");
  return tipoValido(t) ? t : "LIVRE";
}

// ------------------------------------------------------ modelos de processo

/** Cria um modelo. O primeiro já nasce com as etapas de sempre, para editar. */
export async function criarModelo(_: SelecaoState, formData: FormData): Promise<SelecaoState> {
  const session = await requireSession();
  const nome = texto(formData.get("nome"));
  if (!nome) return { error: "Dê um nome ao modelo." };

  const modelo = await prisma.processoModelo.create({
    data: {
      nome,
      descricao: texto(formData.get("descricao")) || null,
      etapas: { create: MODELO_SUGERIDO.map((e, i) => ({ nome: e.nome, tipo: e.tipo, prazoDias: e.prazoDias, ordem: i })) },
    },
    select: { id: true },
  });

  await log(null, session.userId, "CRIOU", modelo.id, `Criou o modelo de processo "${nome}".`);
  refresh();
  return { ok: true, id: modelo.id };
}

export async function renomearModelo(id: string, nome: string, descricao: string): Promise<SelecaoState> {
  await requireSession();
  const limpo = textoSeguro(nome).trim();
  if (!limpo) return { error: "O modelo precisa de um nome." };
  await prisma.processoModelo.update({ where: { id }, data: { nome: limpo, descricao: textoSeguro(descricao).trim() || null } });
  refresh();
  return { ok: true };
}

export async function excluirModelo(id: string): Promise<SelecaoState> {
  await requireSession();
  // As vagas abertas não dependem do modelo: já têm as etapas copiadas.
  await prisma.processoModelo.delete({ where: { id } });
  refresh();
  return { ok: true };
}

export async function adicionarEtapaDoModelo(modeloId: string, _: SelecaoState, formData: FormData): Promise<SelecaoState> {
  await requireSession();
  const nome = texto(formData.get("nome"));
  if (!nome) return { error: "Dê um nome à etapa." };
  const ultima = await prisma.etapaDoModelo.aggregate({ where: { modeloId }, _max: { ordem: true } });
  await prisma.etapaDoModelo.create({
    data: {
      modeloId,
      nome,
      tipo: tipoDoForm(formData.get("tipo")),
      prazoDias: numero(formData.get("prazoDias")),
      ordem: (ultima._max.ordem ?? -1) + 1,
    },
  });
  refresh();
  return { ok: true };
}

export async function editarEtapaDoModelo(id: string, campos: { nome?: string; tipo?: string; prazoDias?: number | null }): Promise<SelecaoState> {
  await requireSession();
  const nome = campos.nome === undefined ? undefined : textoSeguro(campos.nome).trim();
  if (nome !== undefined && !nome) return { error: "A etapa precisa de um nome." };
  await prisma.etapaDoModelo.update({
    where: { id },
    data: {
      ...(nome === undefined ? {} : { nome }),
      ...(campos.tipo === undefined ? {} : { tipo: tipoValido(campos.tipo) ? campos.tipo : "LIVRE" }),
      ...(campos.prazoDias === undefined ? {} : { prazoDias: campos.prazoDias }),
    },
  });
  refresh();
  return { ok: true };
}

export async function excluirEtapaDoModelo(id: string): Promise<SelecaoState> {
  await requireSession();
  await prisma.etapaDoModelo.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/** Sobe ou desce a etapa no modelo, trocando a ordem com a vizinha. */
export async function moverEtapaDoModelo(id: string, direcao: "SUBIR" | "DESCER"): Promise<SelecaoState> {
  await requireSession();
  const etapa = await prisma.etapaDoModelo.findUnique({ where: { id }, select: { id: true, modeloId: true, ordem: true } });
  if (!etapa) return { error: "Etapa não encontrada." };
  const vizinha = await prisma.etapaDoModelo.findFirst({
    where: { modeloId: etapa.modeloId, ordem: direcao === "SUBIR" ? { lt: etapa.ordem } : { gt: etapa.ordem } },
    orderBy: { ordem: direcao === "SUBIR" ? "desc" : "asc" },
    select: { id: true, ordem: true },
  });
  if (!vizinha) return { ok: true };
  await prisma.$transaction([
    prisma.etapaDoModelo.update({ where: { id: etapa.id }, data: { ordem: vizinha.ordem } }),
    prisma.etapaDoModelo.update({ where: { id: vizinha.id }, data: { ordem: etapa.ordem } }),
  ]);
  refresh();
  return { ok: true };
}

// -------------------------------------------------------------------- vagas

/**
 * Abre uma vaga. As etapas vêm do modelo escolhido — cópia, não ligação — e
 * daí em diante são editadas dentro da vaga.
 */
export async function criarVaga(_: SelecaoState, formData: FormData): Promise<SelecaoState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const title = texto(formData.get("title"));
  if (!companyId) return { error: "Escolha a empresa." };
  if (!title) return { error: "Diga o cargo da vaga." };

  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  if (!empresa) return { error: "Empresa não encontrada." };

  const modeloId = String(formData.get("modeloId") ?? "");
  const etapas = modeloId
    ? await prisma.etapaDoModelo.findMany({ where: { modeloId }, orderBy: { ordem: "asc" }, select: { nome: true, tipo: true, prazoDias: true } })
    : [];

  const vaga = await prisma.jobOpening.create({
    data: {
      companyId,
      title,
      notes: texto(formData.get("notes")) || null,
      etapas: { create: etapas.map((e, i) => ({ nome: e.nome, tipo: e.tipo, prazoDias: e.prazoDias, ordem: i })) },
    },
    select: { id: true },
  });

  await log(companyId, session.userId, "CRIOU", vaga.id, `Abriu a vaga de ${title} para ${empresa.name}.`);
  refresh(companyId);
  return { ok: true, id: vaga.id };
}

export async function editarVaga(id: string, campos: { title?: string; notes?: string; status?: string }): Promise<SelecaoState> {
  const session = await requireSession();
  const vaga = await prisma.jobOpening.findUnique({ where: { id }, select: { companyId: true, title: true, status: true } });
  if (!vaga) return { error: "Vaga não encontrada." };

  const title = campos.title === undefined ? undefined : textoSeguro(campos.title).trim();
  if (title !== undefined && !title) return { error: "A vaga precisa de um cargo." };
  const status = campos.status && ["ABERTA", "PAUSADA", "ENCERRADA"].includes(campos.status) ? campos.status : undefined;

  await prisma.jobOpening.update({
    where: { id },
    data: {
      ...(title === undefined ? {} : { title }),
      ...(campos.notes === undefined ? {} : { notes: textoSeguro(campos.notes).trim() || null }),
      ...(status === undefined ? {} : { status: status as "ABERTA" | "PAUSADA" | "ENCERRADA", closedAt: status === "ENCERRADA" ? new Date() : null }),
    },
  });

  if (status && status !== vaga.status) {
    const dito = status === "ENCERRADA" ? "Encerrou" : status === "PAUSADA" ? "Pausou" : "Reabriu";
    await log(vaga.companyId, session.userId, "EDITOU", id, `${dito} a vaga de ${vaga.title}.`);
  }
  refresh(vaga.companyId);
  return { ok: true };
}

/** Exclui a vaga com os candidatos dela. Usado quando a vaga foi criada errada. */
export async function excluirVaga(id: string): Promise<SelecaoState> {
  const session = await requireSession();
  const vaga = await prisma.jobOpening.findUnique({
    where: { id },
    select: { companyId: true, title: true, _count: { select: { candidates: true } } },
  });
  if (!vaga) return { error: "Vaga não encontrada." };

  await prisma.candidate.deleteMany({ where: { jobOpeningId: id } });
  await prisma.jobOpening.delete({ where: { id } });
  await log(
    vaga.companyId,
    session.userId,
    "EXCLUIU",
    id,
    `Excluiu a vaga de ${vaga.title}${vaga._count.candidates > 0 ? `, com ${vaga._count.candidates} candidato(s)` : ""}.`,
  );
  refresh(vaga.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ etapas da vaga

export async function adicionarEtapa(vagaId: string, _: SelecaoState, formData: FormData): Promise<SelecaoState> {
  await requireSession();
  const nome = texto(formData.get("nome"));
  if (!nome) return { error: "Dê um nome à etapa." };
  const vaga = await prisma.jobOpening.findUnique({ where: { id: vagaId }, select: { companyId: true } });
  if (!vaga) return { error: "Vaga não encontrada." };
  const ultima = await prisma.etapaDaVaga.aggregate({ where: { vagaId }, _max: { ordem: true } });
  await prisma.etapaDaVaga.create({
    data: {
      vagaId,
      nome,
      tipo: tipoDoForm(formData.get("tipo")),
      prazoDias: numero(formData.get("prazoDias")),
      ordem: (ultima._max.ordem ?? -1) + 1,
    },
  });
  refresh(vaga.companyId);
  return { ok: true };
}

export async function editarEtapa(id: string, campos: { nome?: string; tipo?: string; prazoDias?: number | null }): Promise<SelecaoState> {
  await requireSession();
  const etapa = await prisma.etapaDaVaga.findUnique({ where: { id }, select: { vaga: { select: { companyId: true } } } });
  if (!etapa) return { error: "Etapa não encontrada." };
  const nome = campos.nome === undefined ? undefined : textoSeguro(campos.nome).trim();
  if (nome !== undefined && !nome) return { error: "A etapa precisa de um nome." };
  await prisma.etapaDaVaga.update({
    where: { id },
    data: {
      ...(nome === undefined ? {} : { nome }),
      ...(campos.tipo === undefined ? {} : { tipo: tipoValido(campos.tipo) ? campos.tipo : "LIVRE" }),
      ...(campos.prazoDias === undefined ? {} : { prazoDias: campos.prazoDias }),
    },
  });
  refresh(etapa.vaga.companyId);
  return { ok: true };
}

/** Só sai etapa vazia: com gente dentro, mover para onde seria decisão dela. */
export async function excluirEtapa(id: string): Promise<SelecaoState> {
  await requireSession();
  const etapa = await prisma.etapaDaVaga.findUnique({
    where: { id },
    select: { nome: true, vaga: { select: { companyId: true } }, _count: { select: { candidatos: true } } },
  });
  if (!etapa) return { error: "Etapa não encontrada." };
  if (etapa._count.candidatos > 0) {
    return { error: `Ainda há candidato em "${etapa.nome}". Mova quem está aí antes de excluir a etapa.` };
  }
  await prisma.etapaDaVaga.delete({ where: { id } });
  refresh(etapa.vaga.companyId);
  return { ok: true };
}

export async function moverEtapa(id: string, direcao: "SUBIR" | "DESCER"): Promise<SelecaoState> {
  await requireSession();
  const etapa = await prisma.etapaDaVaga.findUnique({ where: { id }, select: { id: true, vagaId: true, ordem: true, vaga: { select: { companyId: true } } } });
  if (!etapa) return { error: "Etapa não encontrada." };
  const vizinha = await prisma.etapaDaVaga.findFirst({
    where: { vagaId: etapa.vagaId, ordem: direcao === "SUBIR" ? { lt: etapa.ordem } : { gt: etapa.ordem } },
    orderBy: { ordem: direcao === "SUBIR" ? "desc" : "asc" },
    select: { id: true, ordem: true },
  });
  if (!vizinha) return { ok: true };
  await prisma.$transaction([
    prisma.etapaDaVaga.update({ where: { id: etapa.id }, data: { ordem: vizinha.ordem } }),
    prisma.etapaDaVaga.update({ where: { id: vizinha.id }, data: { ordem: etapa.ordem } }),
  ]);
  refresh(etapa.vaga.companyId);
  return { ok: true };
}

// --------------------------------------------------------------- candidatos

/** Cadastra um candidato à mão, já na primeira etapa da vaga. */
export async function adicionarCandidato(vagaId: string, _: SelecaoState, formData: FormData): Promise<SelecaoState> {
  const session = await requireSession();
  const name = texto(formData.get("name"));
  if (!name) return { error: "Diga o nome do candidato." };

  const vaga = await prisma.jobOpening.findUnique({
    where: { id: vagaId },
    select: { companyId: true, title: true, etapas: { orderBy: { ordem: "asc" }, take: 1, select: { id: true, nome: true } } },
  });
  if (!vaga) return { error: "Vaga não encontrada." };

  const primeira = vaga.etapas[0] ?? null;
  const candidato = await prisma.candidate.create({
    data: {
      companyId: vaga.companyId,
      jobOpeningId: vagaId,
      name,
      email: texto(formData.get("email")) || null,
      phone: texto(formData.get("phone")) || null,
      source: "MANUAL",
      etapaId: primeira?.id ?? null,
      applicationToken: randomBytes(24).toString("hex"),
      ...(primeira
        ? { movimentos: { create: { etapaId: primeira.id, etapaNome: primeira.nome, resultado: "ENTROU", criadoPorId: session.userId } } }
        : {}),
    },
    select: { id: true },
  });

  await log(vaga.companyId, session.userId, "CRIOU", candidato.id, `Cadastrou ${name} na vaga de ${vaga.title}.`);
  refresh(vaga.companyId);
  return { ok: true, id: candidato.id };
}

async function carregarCandidato(id: string) {
  return prisma.candidate.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      companyId: true,
      outcome: true,
      etapaId: true,
      etapa: { select: { id: true, nome: true, ordem: true, vagaId: true } },
      jobOpening: { select: { id: true, title: true } },
    },
  });
}

/**
 * Aprova o candidato na etapa em que está e o leva para a próxima.
 *
 * Sem próxima etapa, o processo dele acabou: fica aprovado, esperando a
 * decisão do cliente.
 */
export async function aprovarCandidato(id: string, motivo: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await carregarCandidato(id);
  if (!c) return { error: "Candidato não encontrado." };
  if (!c.etapa) return { error: "Este candidato ainda não está em uma etapa." };

  const proxima = await prisma.etapaDaVaga.findFirst({
    where: { vagaId: c.etapa.vagaId, ordem: { gt: c.etapa.ordem } },
    orderBy: { ordem: "asc" },
    select: { id: true, nome: true },
  });

  const agora = new Date();
  await prisma.$transaction([
    prisma.movimentoDoCandidato.create({
      data: { candidateId: id, etapaId: c.etapa.id, etapaNome: c.etapa.nome, resultado: "APROVADO", motivo: textoSeguro(motivo).trim() || null, criadoPorId: session.userId },
    }),
    ...(proxima
      ? [
          prisma.movimentoDoCandidato.create({
            data: { candidateId: id, etapaId: proxima.id, etapaNome: proxima.nome, resultado: "ENTROU", criadoPorId: session.userId },
          }),
        ]
      : []),
    prisma.candidate.update({
      where: { id },
      data: proxima
        ? { etapaId: proxima.id, etapaDesde: agora, cobradoEm: null }
        : { outcome: "APROVADO", etapaDesde: agora },
    }),
  ]);

  await log(
    c.companyId ?? "",
    session.userId,
    "EDITOU",
    id,
    proxima
      ? `${c.name} passou de "${c.etapa.nome}" para "${proxima.nome}".`
      : `${c.name} foi aprovado no processo da vaga de ${c.jobOpening?.title ?? ""}.`,
  );
  refresh(c.companyId);
  return { ok: true };
}

/** Encerra o processo do candidato: reprovado ou desistente, sempre com motivo. */
export async function encerrarCandidato(id: string, resultado: "REPROVADO" | "DESISTIU", motivo: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await carregarCandidato(id);
  if (!c) return { error: "Candidato não encontrado." };
  const limpo = textoSeguro(motivo).trim();
  if (!limpo) return { error: "Escreva o motivo: é ele que vira o retorno e o histórico da vaga." };

  await prisma.$transaction([
    prisma.movimentoDoCandidato.create({
      data: {
        candidateId: id,
        etapaId: c.etapa?.id ?? null,
        etapaNome: c.etapa?.nome ?? "Sem etapa",
        resultado,
        motivo: limpo,
        criadoPorId: session.userId,
      },
    }),
    prisma.candidate.update({ where: { id }, data: { outcome: resultado, etapaDesde: new Date() } }),
  ]);

  await log(
    c.companyId ?? "",
    session.userId,
    "EDITOU",
    id,
    `${c.name} ${resultado === "REPROVADO" ? "foi reprovado" : "desistiu"} em "${c.etapa?.nome ?? "sem etapa"}": ${limpo}`,
  );
  refresh(c.companyId);
  return { ok: true };
}

/** Traz de volta quem saiu por engano, para a etapa em que estava. */
export async function reabrirCandidato(id: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await carregarCandidato(id);
  if (!c) return { error: "Candidato não encontrado." };
  await prisma.candidate.update({ where: { id }, data: { outcome: "EM_ANDAMENTO", etapaDesde: new Date(), avisadoEm: null } });
  await log(c.companyId, session.userId, "EDITOU", id, `Reabriu o processo de ${c.name}.`);
  refresh(c.companyId);
  return { ok: true };
}

/** Move o candidato para outra etapa da mesma vaga, sem ser pelo "aprovar". */
export async function moverCandidato(id: string, etapaId: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await carregarCandidato(id);
  if (!c) return { error: "Candidato não encontrado." };
  const destino = await prisma.etapaDaVaga.findUnique({ where: { id: etapaId }, select: { id: true, nome: true, vagaId: true } });
  if (!destino || destino.vagaId !== c.jobOpening?.id) return { error: "Esta etapa não é da vaga do candidato." };
  if (destino.id === c.etapaId) return { ok: true };

  await prisma.$transaction([
    prisma.movimentoDoCandidato.create({
      data: { candidateId: id, etapaId: destino.id, etapaNome: destino.nome, resultado: "ENTROU", criadoPorId: session.userId },
    }),
    prisma.candidate.update({ where: { id }, data: { etapaId: destino.id, etapaDesde: new Date(), cobradoEm: null } }),
  ]);
  await log(c.companyId, session.userId, "EDITOU", id, `Moveu ${c.name} para "${destino.nome}".`);
  refresh(c.companyId);
  return { ok: true };
}

/** Anota o que aconteceu com o candidato na etapa em que ele está. */
export async function anotarNaEtapa(id: string, anotacao: string): Promise<SelecaoState> {
  await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id }, select: { companyId: true, etapaId: true, stageNotes: true } });
  if (!c) return { error: "Candidato não encontrado." };
  const chave = c.etapaId ?? "SEM_ETAPA";
  const notas = (c.stageNotes && typeof c.stageNotes === "object" && !Array.isArray(c.stageNotes) ? { ...(c.stageNotes as Record<string, unknown>) } : {}) as Record<string, string>;
  const limpo = textoSeguro(anotacao).trim();
  if (limpo) notas[chave] = limpo;
  else delete notas[chave];
  await prisma.candidate.update({ where: { id }, data: { stageNotes: notas } });
  refresh(c.companyId);
  return { ok: true };
}

/** Marca que a ficha ou o teste foi cobrado hoje — para não cobrar duas vezes. */
export async function marcarCobrado(id: string): Promise<SelecaoState> {
  await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id }, select: { companyId: true } });
  if (!c) return { error: "Candidato não encontrado." };
  await prisma.candidate.update({ where: { id }, data: { cobradoEm: new Date() } });
  refresh(c.companyId);
  return { ok: true };
}

/** Marca que o candidato já recebeu o retorno do processo. */
export async function marcarAvisado(id: string, avisado: boolean): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id }, select: { companyId: true, name: true } });
  if (!c) return { error: "Candidato não encontrado." };
  await prisma.candidate.update({ where: { id }, data: { avisadoEm: avisado ? new Date() : null } });
  if (avisado) await log(c.companyId, session.userId, "EDITOU", id, `Avisou ${c.name} do resultado do processo.`);
  refresh(c.companyId);
  return { ok: true };
}

export async function excluirCandidato(id: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id }, select: { companyId: true, name: true } });
  if (!c) return { error: "Candidato não encontrado." };
  await prisma.candidate.delete({ where: { id } });
  await log(c.companyId, session.userId, "EXCLUIU", id, `Excluiu o candidato ${c.name}.`);
  refresh(c.companyId);
  return { ok: true };
}
