"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { apagarComPermissao, respostasQueSomem } from "@/lib/respostas-protegidas-dados";
import { requireSession } from "@/lib/session";
import { textoDoFormulario as texto, textoSeguro } from "@/lib/texto-seguro";
import { atividade } from "@/lib/atividade";
import { MODELO_SUGERIDO, tipoValido, type EtapaTipo } from "@/lib/selecao";
import { lerEntrevista, lerPerguntas, TETO_DA_TRANSCRICAO, type Entrevista } from "@/lib/entrevista";
import { organizarTranscricao } from "@/lib/ai-entrevista";
import { nomeDoCurriculo, problemaDoCurriculo } from "@/lib/curriculo";
import { lerAvaliacao, type Avaliacao } from "@/lib/fluxo-da-vaga";
import { assinaturaDaPasta, avaliarPasta, dadosDaPasta, rascunharParecer } from "@/lib/ai-parecer";
import { assinarDossie } from "@/lib/dossie-link";

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

/** `respostas`: o que se perde respondido por link; a tela pergunta e chama de novo. */
export type SelecaoState = { error?: string; ok?: boolean; id?: string; respostas?: string };

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

  // O cargo da lista traz o roteiro de entrevista; daqui em diante a vaga anda sozinha.
  const cargoId = String(formData.get("cargoId") ?? "");
  const cargo = cargoId
    ? await prisma.cargo.findFirst({ where: { id: cargoId, companyId }, select: { id: true, perguntasDaEntrevista: true } })
    : null;
  const perguntas = cargo ? lerPerguntas(cargo.perguntasDaEntrevista) : [];

  const modeloId = String(formData.get("modeloId") ?? "");
  const etapas = modeloId
    ? await prisma.etapaDoModelo.findMany({ where: { modeloId }, orderBy: { ordem: "asc" }, select: { nome: true, tipo: true, prazoDias: true } })
    : [];

  const vaga = await prisma.jobOpening.create({
    data: {
      companyId,
      title,
      cargoId: cargo?.id ?? null,
      ...(perguntas.length ? { perguntasDaEntrevista: perguntas } : {}),
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
export async function excluirVaga(id: string, apagarRespostas = false): Promise<SelecaoState> {
  const session = await requireSession();
  const vaga = await prisma.jobOpening.findUnique({
    where: { id },
    select: { companyId: true, title: true, _count: { select: { candidates: true } } },
  });
  if (!vaga) return { error: "Vaga não encontrada." };
  const respostas = await respostasQueSomem({ jobOpeningId: id });
  if (respostas && !apagarRespostas) return { respostas };

  await apagarComPermissao([
    prisma.candidate.deleteMany({ where: { jobOpeningId: id } }),
    prisma.jobOpening.delete({ where: { id } }),
  ]);
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

// ------------------------------------------------------------------- ficha

/**
 * Prepara o envio da ficha: marca a data e devolve o token do link. Mandar de
 * novo não gera outro link — é o mesmo, para a pessoa não ficar com dois.
 */
export async function enviarFicha(id: string): Promise<SelecaoState & { token?: string }> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({
    where: { id },
    select: { name: true, companyId: true, applicationToken: true, applicationSentAt: true, applicationAnsweredAt: true },
  });
  if (!c) return { error: "Candidato não encontrado." };
  if (c.applicationAnsweredAt) return { error: "A ficha deste candidato já foi respondida." };
  if (!c.applicationSentAt) {
    await prisma.candidate.update({ where: { id }, data: { applicationSentAt: new Date() } });
    await log(c.companyId, session.userId, "EDITOU", id, `Mandou a ficha de solicitação de emprego para ${c.name}.`);
    refresh(c.companyId);
  }
  return { ok: true, token: c.applicationToken };
}

// ------------------------------------------------------------------ dossiê

/**
 * O link do dossiê para mandar ao cliente pelo WhatsApp, com o telefone do
 * contato da empresa (se houver) e o nome do candidato e da vaga para a
 * mensagem.
 */
export async function linkDoDossie(
  candidatoId: string,
): Promise<SelecaoState & { token?: string; telefone?: string | null; nome?: string; vaga?: string; contato?: string | null }> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({
    where: { id: candidatoId },
    select: {
      name: true,
      companyId: true,
      jobOpening: { select: { title: true, company: { select: { contactName: true, contactPhone: true } } } },
    },
  });
  if (!c || !c.jobOpening) return { error: "Candidato não encontrado." };
  await log(c.companyId, session.userId, "EDITOU", candidatoId, `Mandou o dossiê de ${c.name} para o cliente.`);
  return {
    ok: true,
    token: await assinarDossie(candidatoId),
    telefone: c.jobOpening.company?.contactPhone ?? null,
    contato: c.jobOpening.company?.contactName ?? null,
    nome: c.name,
    vaga: c.jobOpening.title,
  };
}

// -------------------------------------------------------------- entrevista

/** O roteiro de perguntas da vaga, uma por linha. */
export async function salvarPerguntasDaEntrevista(vagaId: string, perguntas: string[]): Promise<SelecaoState> {
  await requireSession();
  const vaga = await prisma.jobOpening.findUnique({ where: { id: vagaId }, select: { companyId: true } });
  if (!vaga) return { error: "Vaga não encontrada." };
  await prisma.jobOpening.update({ where: { id: vagaId }, data: { perguntasDaEntrevista: lerPerguntas(perguntas) } });
  refresh(vaga.companyId);
  return { ok: true };
}

/** Copia o roteiro de outra vaga para esta, substituindo o que houver. */
export async function copiarPerguntasDaEntrevista(vagaId: string, deVagaId: string): Promise<SelecaoState> {
  await requireSession();
  const [vaga, origem] = await Promise.all([
    prisma.jobOpening.findUnique({ where: { id: vagaId }, select: { companyId: true } }),
    prisma.jobOpening.findUnique({ where: { id: deVagaId }, select: { perguntasDaEntrevista: true } }),
  ]);
  if (!vaga || !origem) return { error: "Vaga não encontrada." };
  const perguntas = lerPerguntas(origem.perguntasDaEntrevista);
  if (perguntas.length === 0) return { error: "A vaga escolhida não tem perguntas cadastradas." };
  await prisma.jobOpening.update({ where: { id: vagaId }, data: { perguntasDaEntrevista: perguntas } });
  refresh(vaga.companyId);
  return { ok: true };
}

/**
 * Organiza a transcrição nas perguntas da vaga, pela IA.
 *
 * Não grava: devolve o rascunho para ela revisar na tela, e só o "Salvar"
 * grava. Assim nada que a IA escreveu entra na pasta sem ela ter lido.
 */
export async function organizarEntrevista(
  candidatoId: string,
  transcricao: string,
): Promise<SelecaoState & { entrevista?: Entrevista }> {
  await requireSession();
  const limpo = textoSeguro(transcricao).trim();
  if (limpo.length < 200) return { error: "Cole a transcrição da entrevista: o texto está curto demais para organizar." };
  if (limpo.length > TETO_DA_TRANSCRICAO) {
    return { error: `A transcrição passou de ${TETO_DA_TRANSCRICAO.toLocaleString("pt-BR")} caracteres. Divida em partes ou corte o que não é entrevista.` };
  }

  const c = await prisma.candidate.findUnique({
    where: { id: candidatoId },
    select: { entrevista: true, jobOpening: { select: { perguntasDaEntrevista: true } } },
  });
  if (!c) return { error: "Candidato não encontrado." };
  // Reorganizar uma entrevista já salva usa as perguntas dela, não as de hoje.
  const salvas = lerEntrevista(c.entrevista);
  const perguntas = salvas?.respostas.length ? salvas.respostas.map((r) => r.pergunta) : lerPerguntas(c.jobOpening?.perguntasDaEntrevista);
  if (perguntas.length === 0) return { error: "Cadastre as perguntas da entrevista na vaga antes de organizar." };

  try {
    const { respostas, outros } = await organizarTranscricao(perguntas, limpo);
    return {
      ok: true,
      entrevista: { transcricao: limpo, respostas, outros, avaliacao: salvas?.avaliacao ?? "", organizadaEm: new Date().toISOString() },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível organizar a entrevista." };
  }
}

/** Grava a entrevista como ela revisou. */
export async function salvarEntrevista(candidatoId: string, entrevista: Entrevista): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id: candidatoId }, select: { name: true, companyId: true, entrevistaEm: true } });
  if (!c) return { error: "Candidato não encontrado." };
  const lida = lerEntrevista(entrevista);
  if (!lida || lida.respostas.length === 0) return { error: "A entrevista está vazia." };

  await prisma.candidate.update({ where: { id: candidatoId }, data: { entrevista: lida, entrevistaEm: c.entrevistaEm ?? new Date() } });
  if (!c.entrevistaEm) await log(c.companyId, session.userId, "EDITOU", candidatoId, `Registrou a entrevista de ${c.name}.`);
  refresh(c.companyId);
  return { ok: true };
}

/**
 * Rascunho do parecer final pela IA, a partir de tudo o que está na pasta.
 * Não grava: volta para a tela, onde ela lê, ajusta e salva.
 */
export async function sugerirParecer(candidatoId: string): Promise<SelecaoState & { parecer?: string }> {
  await requireSession();
  const dados = await dadosDaPasta(candidatoId);
  if (!dados) return { error: "Candidato não encontrado." };
  if (dados === "vazia") return { error: "A pasta ainda está vazia: sem ficha, testes ou entrevista não há o que resumir." };
  try {
    const parecer = await rascunharParecer(dados);
    if (!parecer) return { error: "A IA não devolveu texto. Tente de novo em instantes." };
    return { ok: true, parecer };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível sugerir o parecer." };
  }
}

/**
 * A avaliação automática do candidato. Se a guardada ainda é da pasta como
 * está agora, volta ela mesma; senão a IA avalia de novo e grava.
 */
export async function avaliarCandidato(candidatoId: string, refazer = false): Promise<SelecaoState & { avaliacao?: Avaliacao }> {
  await requireSession();
  const [dados, c] = await Promise.all([
    dadosDaPasta(candidatoId),
    prisma.candidate.findUnique({ where: { id: candidatoId }, select: { companyId: true, avaliacaoAutomatica: true } }),
  ]);
  if (!dados || !c) return { error: "Candidato não encontrado." };
  if (dados === "vazia") return { error: "A pasta ainda está vazia: a avaliação sai quando houver ficha, teste ou entrevista." };
  const guardada = lerAvaliacao(c.avaliacaoAutomatica);
  if (!refazer && guardada && guardada.assinatura === assinaturaDaPasta(dados)) return { ok: true, avaliacao: guardada };
  try {
    const avaliacao = await avaliarPasta(dados);
    if (!avaliacao) return { error: "A IA não devolveu uma avaliação legível. Tente de novo em instantes." };
    await prisma.candidate.update({ where: { id: candidatoId }, data: { avaliacaoAutomatica: avaliacao } });
    refresh(c.companyId);
    return { ok: true, avaliacao };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível avaliar o candidato." };
  }
}

/** O parecer final da consultoria, na aba Resultado da pasta. */
export async function salvarParecerFinal(candidatoId: string, parecer: string): Promise<SelecaoState> {
  const session = await requireSession();
  const c = await prisma.candidate.findUnique({ where: { id: candidatoId }, select: { name: true, companyId: true } });
  if (!c) return { error: "Candidato não encontrado." };
  const limpo = textoSeguro(parecer).trim().slice(0, 10_000);
  await prisma.candidate.update({ where: { id: candidatoId }, data: { finalNotes: limpo || null } });
  await log(c.companyId, session.userId, "EDITOU", candidatoId, `Atualizou o parecer final de ${c.name}.`);
  refresh(c.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ fluxo da vaga

/** Liga a vaga a um cargo da empresa (ou desliga). O roteiro do cargo vem junto se a vaga ainda não tem. */
export async function escolherCargoDaVaga(vagaId: string, cargoId: string): Promise<SelecaoState> {
  const session = await requireSession();
  const vaga = await prisma.jobOpening.findUnique({ where: { id: vagaId }, select: { companyId: true, title: true, perguntasDaEntrevista: true } });
  if (!vaga) return { error: "Vaga não encontrada." };
  if (!cargoId) {
    await prisma.jobOpening.update({ where: { id: vagaId }, data: { cargoId: null } });
    refresh(vaga.companyId);
    return { ok: true };
  }
  const cargo = await prisma.cargo.findFirst({ where: { id: cargoId, companyId: vaga.companyId }, select: { id: true, nome: true, perguntasDaEntrevista: true } });
  if (!cargo) return { error: "Este cargo não é da empresa da vaga." };
  const roteiroDoCargo = lerPerguntas(cargo.perguntasDaEntrevista);
  const vagaSemRoteiro = lerPerguntas(vaga.perguntasDaEntrevista).length === 0;
  await prisma.jobOpening.update({
    where: { id: vagaId },
    data: { cargoId: cargo.id, ...(vagaSemRoteiro && roteiroDoCargo.length ? { perguntasDaEntrevista: roteiroDoCargo } : {}) },
  });
  await log(vaga.companyId, session.userId, "EDITOU", vagaId, `Ligou a vaga de ${vaga.title} ao cargo ${cargo.nome}.`);
  refresh(vaga.companyId);
  return { ok: true };
}

/**
 * Liga um teste feito pela aba Testes a um candidato da vaga, ou cadastra a
 * pessoa como candidato novo (candidatoId "NOVO") já com o teste.
 */
export async function ligarTesteAoCandidato(testeId: string, vagaId: string, candidatoId: string): Promise<SelecaoState> {
  const session = await requireSession();
  const [teste, vaga] = await Promise.all([
    prisma.testeEnviado.findUnique({ where: { id: testeId }, select: { id: true, pessoa: true, telefone: true, nomeDoTeste: true, companyId: true, candidateId: true } }),
    prisma.jobOpening.findUnique({
      where: { id: vagaId },
      select: { companyId: true, title: true, etapas: { orderBy: { ordem: "asc" }, take: 1, select: { id: true, nome: true } } },
    }),
  ]);
  if (!teste || !vaga) return { error: "Teste ou vaga não encontrado." };
  if (teste.candidateId) return { error: "Este teste já está ligado a um candidato." };
  if (teste.companyId && teste.companyId !== vaga.companyId) return { error: "Este teste foi feito para outra empresa." };

  let alvo: { id: string; name: string } | null;
  if (candidatoId === "NOVO") {
    const primeira = vaga.etapas[0] ?? null;
    alvo = await prisma.candidate.create({
      data: {
        companyId: vaga.companyId,
        jobOpeningId: vagaId,
        name: textoSeguro(teste.pessoa).trim() || "Sem nome",
        phone: teste.telefone,
        source: "MANUAL",
        etapaId: primeira?.id ?? null,
        applicationToken: randomBytes(24).toString("hex"),
        ...(primeira
          ? { movimentos: { create: { etapaId: primeira.id, etapaNome: primeira.nome, resultado: "ENTROU", criadoPorId: session.userId } } }
          : {}),
      },
      select: { id: true, name: true },
    });
  } else {
    alvo = await prisma.candidate.findFirst({ where: { id: candidatoId, jobOpeningId: vagaId }, select: { id: true, name: true } });
    if (!alvo) return { error: "Escolha um candidato desta vaga." };
  }

  await prisma.testeEnviado.update({ where: { id: teste.id }, data: { candidateId: alvo.id, companyId: teste.companyId ?? vaga.companyId } });
  await log(vaga.companyId, session.userId, "EDITOU", alvo.id, `Ligou o teste "${teste.nomeDoTeste}" a ${alvo.name}, na vaga de ${vaga.title}.`);
  refresh(vaga.companyId);
  return { ok: true, id: alvo.id };
}

// --------------------------------------------------------------- currículo

/** Anexa o currículo em PDF ao candidato. */
export async function anexarCurriculo(formData: FormData): Promise<SelecaoState> {
  const session = await requireSession();
  const candidatoId = String(formData.get("candidatoId") ?? "");
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File)) return { error: "Escolha o arquivo do currículo." };

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const problema = problemaDoCurriculo(bytes.length, bytes.subarray(0, 1100));
  if (problema) return { error: problema };

  const c = await prisma.candidate.findUnique({ where: { id: candidatoId }, select: { name: true, companyId: true } });
  if (!c) return { error: "Candidato não encontrado." };

  const nome = textoSeguro(nomeDoCurriculo(arquivo.name));
  await prisma.arquivoDoCandidato.create({
    data: { candidateId: candidatoId, nome, tamanho: bytes.length, dados: bytes, enviadoPor: session.name },
  });
  await log(c.companyId, session.userId, "EDITOU", candidatoId, `Anexou o currículo de ${c.name} ("${nome}").`);
  refresh(c.companyId);
  return { ok: true };
}

export async function excluirCurriculo(id: string): Promise<SelecaoState> {
  const session = await requireSession();
  const a = await prisma.arquivoDoCandidato.findUnique({
    where: { id },
    select: { nome: true, candidate: { select: { id: true, name: true, companyId: true } } },
  });
  if (!a) return { error: "Arquivo não encontrado." };
  await prisma.arquivoDoCandidato.delete({ where: { id } });
  await log(a.candidate.companyId, session.userId, "EXCLUIU", a.candidate.id, `Excluiu o currículo "${a.nome}" de ${a.candidate.name}.`);
  refresh(a.candidate.companyId);
  return { ok: true };
}
