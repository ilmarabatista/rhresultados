"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido, horaValida } from "@/lib/agenda";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import { textoSeguro } from "@/lib/texto-seguro";
import {
  lerNivel,
  lerProgresso,
  lerQuantoFeito,
  lerStatusDaMeta,
  lerTipoDeAcao,
  lerTipoDeCompetencia,
  metaSugerida,
  statusPeloProgresso,
} from "@/lib/pdi";

/**
 * PDI: descrição de cargo com competências, avaliação dos gaps feita junto
 * com a pessoa, plano com metas SMART e ações, e as conversas de
 * acompanhamento. A próxima conversa vai para a agenda da empresa.
 */

export type PdiState = { error?: string; ok?: boolean; id?: string };

const log = atividade("PDI");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
  revalidatePath("/agenda");
}

function texto(valor: FormDataEntryValue | string | null | undefined, max = 4000): string | null {
  const t = textoSeguro(String(valor ?? "")).trim().slice(0, max);
  return t === "" ? null : t;
}

function dia(valor: FormDataEntryValue | string | null | undefined): Date | null {
  const v = String(valor ?? "").trim();
  return diaValido(v) ? dayKeyToDate(v) : null;
}

// --------------------------------------------------------- descrição do cargo

export async function salvarDescricaoDoCargo(_prev: PdiState, formData: FormData): Promise<PdiState> {
  const session = await requireSession();
  const cargoId = String(formData.get("cargoId") ?? "");
  const cargo = await prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true } });
  if (!cargo) return { error: "Cargo não encontrado." };

  await prisma.cargo.update({
    where: { id: cargoId },
    data: {
      missao: texto(formData.get("missao")),
      responsabilidades: texto(formData.get("responsabilidades"), 8000),
      requisitos: texto(formData.get("requisitos")),
    },
  });
  await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Atualizou a descrição do cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

export async function salvarCompetencia(_prev: PdiState, formData: FormData): Promise<PdiState> {
  const session = await requireSession();
  const cargoId = String(formData.get("cargoId") ?? "");
  const id = String(formData.get("competenciaId") ?? "") || null;
  const nome = texto(formData.get("nome"), 120);
  const nivel = lerNivel(formData.get("nivelEsperado"));
  if (!nome || nome.length < 2) return { error: "Dê um nome à competência." };
  if (!nivel) return { error: "Escolha o nível que o cargo pede, de 1 a 5." };

  const cargo = await prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true } });
  if (!cargo) return { error: "Cargo não encontrado." };

  const dados = {
    nome,
    tipo: lerTipoDeCompetencia(String(formData.get("tipo") ?? "")),
    descricao: texto(formData.get("descricao")),
    nivelEsperado: nivel,
  };

  if (id) {
    const { count } = await prisma.competenciaDoCargo.updateMany({ where: { id, cargoId }, data: dados });
    if (count === 0) return { error: "Competência não encontrada." };
  } else {
    const ordem = await prisma.competenciaDoCargo.count({ where: { cargoId } });
    await prisma.competenciaDoCargo.create({ data: { ...dados, cargoId, ordem } });
    await log(cargo.companyId, session.userId, "CRIOU", cargoId, `Incluiu ${nome} nas competências de ${cargo.nome}.`);
  }
  refresh(cargo.companyId);
  return { ok: true };
}

export async function excluirCompetencia(competenciaId: string): Promise<PdiState> {
  const session = await requireSession();
  const c = await prisma.competenciaDoCargo.findUnique({
    where: { id: competenciaId },
    select: { nome: true, cargoId: true, cargo: { select: { companyId: true, nome: true } } },
  });
  if (!c) return { ok: true };
  // As avaliações já feitas guardaram nome e nível: não se perdem.
  await prisma.competenciaDoCargo.delete({ where: { id: competenciaId } });
  await log(c.cargo.companyId, session.userId, "EXCLUIU", c.cargoId, `Tirou ${c.nome} das competências de ${c.cargo.nome}.`);
  refresh(c.cargo.companyId);
  return { ok: true };
}

export async function moverCompetencia(competenciaId: string, direcao: -1 | 1): Promise<PdiState> {
  await requireSession();
  const c = await prisma.competenciaDoCargo.findUnique({
    where: { id: competenciaId },
    select: { cargoId: true, cargo: { select: { companyId: true } } },
  });
  if (!c) return { ok: true };
  const lista = await prisma.competenciaDoCargo.findMany({
    where: { cargoId: c.cargoId },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true },
  });
  const i = lista.findIndex((x) => x.id === competenciaId);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return { ok: true };
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await prisma.$transaction(lista.map((x, ordem) => prisma.competenciaDoCargo.update({ where: { id: x.id }, data: { ordem } })));
  refresh(c.cargo.companyId);
  return { ok: true };
}

/** Copia as competências de outro cargo da empresa, sem repetir nome. */
export async function copiarCompetencias(cargoId: string, origemId: string): Promise<PdiState & { copiadas?: number }> {
  const session = await requireSession();
  const [destino, origem] = await Promise.all([
    prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true, competencias: { select: { nome: true } } } }),
    prisma.cargo.findUnique({ where: { id: origemId }, select: { companyId: true, nome: true, competencias: { orderBy: { ordem: "asc" } } } }),
  ]);
  if (!destino || !origem || destino.companyId !== origem.companyId) return { error: "Cargo não encontrado." };

  const ja = new Set(destino.competencias.map((c) => c.nome.trim().toLowerCase()));
  const novas = origem.competencias.filter((c) => !ja.has(c.nome.trim().toLowerCase()));
  await prisma.competenciaDoCargo.createMany({
    data: novas.map((c, i) => ({
      cargoId,
      nome: c.nome,
      tipo: c.tipo,
      descricao: c.descricao,
      nivelEsperado: c.nivelEsperado,
      ordem: destino.competencias.length + i,
    })),
  });
  await log(destino.companyId, session.userId, "CRIOU", cargoId, `Copiou ${novas.length} competência(s) de ${origem.nome} para ${destino.nome}.`);
  refresh(destino.companyId);
  return { ok: true, copiadas: novas.length };
}

// ------------------------------------------------------------- avaliação

/**
 * Abre uma avaliação: as competências do cargo da pessoa são copiadas para
 * ela, com o nível esperado do dia. Mudar o cargo depois não mexe nela.
 */
export async function criarAvaliacao(employeeId: string, diaDaAvaliacao: string): Promise<PdiState> {
  const session = await requireSession();
  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      name: true,
      companyId: true,
      cargo: { select: { id: true, nome: true, competencias: { orderBy: [{ ordem: "asc" }, { nome: "asc" }] } } },
    },
  });
  if (!pessoa) return { error: "Pessoa não encontrada." };
  if (!pessoa.cargo) return { error: "Escolha o cargo da pessoa no cadastro antes de avaliar." };
  if (pessoa.cargo.competencias.length === 0) {
    return { error: `O cargo ${pessoa.cargo.nome} ainda não tem competências. Descreva o cargo primeiro.` };
  }

  const avaliacao = await prisma.avaliacaoDeCompetencias.create({
    data: {
      employeeId,
      cargoId: pessoa.cargo.id,
      cargoNome: pessoa.cargo.nome,
      data: dia(diaDaAvaliacao) ?? dayKeyToDate(todayKey()),
      createdById: session.userId,
      notas: {
        create: pessoa.cargo.competencias.map((c, ordem) => ({
          competenciaId: c.id,
          nome: c.nome,
          tipo: c.tipo,
          esperado: c.nivelEsperado,
          ordem,
        })),
      },
    },
    select: { id: true },
  });
  await log(pessoa.companyId, session.userId, "CRIOU", employeeId, `Abriu uma avaliação de competências de ${pessoa.name}.`);
  refresh(pessoa.companyId);
  return { ok: true, id: avaliacao.id };
}

async function empresaDaNota(notaId: string) {
  const n = await prisma.notaDeCompetencia.findUnique({
    where: { id: notaId },
    select: { avaliacao: { select: { employee: { select: { companyId: true } } } } },
  });
  return n?.avaliacao.employee.companyId ?? null;
}

export type CampoDaNota = "pessoa" | "avaliador" | "acordado" | "esperado";

/** Grava uma nota da grade na hora do clique. Clicar na nota que já está tira. */
export async function marcarNota(notaId: string, campo: CampoDaNota, valor: number | null): Promise<PdiState> {
  await requireSession();
  if (!["pessoa", "avaliador", "acordado", "esperado"].includes(campo)) return { error: "Campo inválido." };
  const nivel = valor == null ? null : lerNivel(valor);
  if (campo === "esperado" && nivel == null) return { error: "O nível esperado vai de 1 a 5." };
  const companyId = await empresaDaNota(notaId);
  if (!companyId) return { error: "Nota não encontrada." };
  await prisma.notaDeCompetencia.update({ where: { id: notaId }, data: { [campo]: nivel } });
  refresh(companyId);
  return { ok: true };
}

export async function comentarNota(notaId: string, comentario: string): Promise<PdiState> {
  await requireSession();
  const companyId = await empresaDaNota(notaId);
  if (!companyId) return { error: "Nota não encontrada." };
  await prisma.notaDeCompetencia.update({ where: { id: notaId }, data: { comentario: texto(comentario, 2000) } });
  refresh(companyId);
  return { ok: true };
}

/** Uma competência fora da descrição do cargo, só nesta avaliação. */
export async function incluirNaAvaliacao(avaliacaoId: string, nome: string, tipo: string, esperado: number): Promise<PdiState> {
  await requireSession();
  const limpo = texto(nome, 120);
  const nivel = lerNivel(esperado);
  if (!limpo || limpo.length < 2) return { error: "Dê um nome à competência." };
  if (!nivel) return { error: "Escolha o nível esperado." };
  const a = await prisma.avaliacaoDeCompetencias.findUnique({
    where: { id: avaliacaoId },
    select: { employee: { select: { companyId: true } }, _count: { select: { notas: true } } },
  });
  if (!a) return { error: "Avaliação não encontrada." };
  await prisma.notaDeCompetencia.create({
    data: { avaliacaoId, nome: limpo, tipo: lerTipoDeCompetencia(tipo), esperado: nivel, ordem: a._count.notas },
  });
  refresh(a.employee.companyId);
  return { ok: true };
}

export async function tirarDaAvaliacao(notaId: string): Promise<PdiState> {
  await requireSession();
  const companyId = await empresaDaNota(notaId);
  if (!companyId) return { ok: true };
  await prisma.notaDeCompetencia.delete({ where: { id: notaId } });
  refresh(companyId);
  return { ok: true };
}

export type CampoDaAvaliacao = "pontosFortes" | "querDesenvolver" | "apoio" | "carreira" | "data";

export async function mudarAvaliacao(avaliacaoId: string, campo: CampoDaAvaliacao, valor: string): Promise<PdiState> {
  await requireSession();
  const a = await prisma.avaliacaoDeCompetencias.findUnique({
    where: { id: avaliacaoId },
    select: { employee: { select: { companyId: true } } },
  });
  if (!a) return { error: "Avaliação não encontrada." };
  if (campo === "data") {
    const d = dia(valor);
    if (!d) return { error: "Data inválida." };
    await prisma.avaliacaoDeCompetencias.update({ where: { id: avaliacaoId }, data: { data: d } });
  } else if (["pontosFortes", "querDesenvolver", "apoio", "carreira"].includes(campo)) {
    await prisma.avaliacaoDeCompetencias.update({ where: { id: avaliacaoId }, data: { [campo]: texto(valor) } });
  } else {
    return { error: "Campo inválido." };
  }
  refresh(a.employee.companyId);
  return { ok: true };
}

export async function excluirAvaliacao(avaliacaoId: string): Promise<PdiState> {
  const session = await requireSession();
  const a = await prisma.avaliacaoDeCompetencias.findUnique({
    where: { id: avaliacaoId },
    select: { employeeId: true, employee: { select: { companyId: true, name: true } } },
  });
  if (!a) return { ok: true };
  await prisma.avaliacaoDeCompetencias.delete({ where: { id: avaliacaoId } });
  await log(a.employee.companyId, session.userId, "EXCLUIU", a.employeeId, `Excluiu uma avaliação de competências de ${a.employee.name}.`);
  refresh(a.employee.companyId);
  return { ok: true };
}

// ------------------------------------------------------------------ plano

/**
 * Cria o plano. Os gaps escolhidos da avaliação já viram metas, com o
 * específico, o mensurável e o relevante sugeridos para ela ajustar.
 */
export async function criarPlano(_prev: PdiState, formData: FormData): Promise<PdiState> {
  const session = await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "");
  const avaliacaoId = String(formData.get("avaliacaoId") ?? "") || null;
  const title = texto(formData.get("title"), 160);
  const inicio = dia(formData.get("startDate"));
  const fim = dia(formData.get("endDate"));
  const notaIds = formData.getAll("notaIds").map(String);

  if (!title || title.length < 2) return { error: "Dê um nome ao plano." };
  if (inicio && fim && fim < inicio) return { error: "O fim do plano não pode ser antes do início." };

  const pessoa = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true, name: true } });
  if (!pessoa) return { error: "Pessoa não encontrada." };

  const notas = avaliacaoId
    ? await prisma.notaDeCompetencia.findMany({
        where: { id: { in: notaIds }, avaliacao: { id: avaliacaoId, employeeId } },
        orderBy: { ordem: "asc" },
      })
    : [];

  const plano = await prisma.developmentPlan.create({
    data: {
      employeeId,
      avaliacaoId,
      title,
      objective: texto(formData.get("objective")),
      startDate: inicio,
      endDate: fim,
      metas: {
        create: notas.map((n, ordem) => {
          const s = metaSugerida(n);
          return {
            notaId: n.id,
            competencia: n.nome,
            titulo: s.titulo,
            indicador: s.indicador,
            relevancia: s.relevancia,
            prazo: fim,
            ordem,
          };
        }),
      },
    },
    select: { id: true },
  });

  await log(pessoa.companyId, session.userId, "CRIOU", employeeId, `Criou o PDI "${title}" de ${pessoa.name}, com ${notas.length} meta(s).`);
  refresh(pessoa.companyId);
  return { ok: true, id: plano.id };
}

async function carregarPlano(planId: string) {
  return prisma.developmentPlan.findUnique({
    where: { id: planId },
    select: {
      id: true,
      title: true,
      status: true,
      visitId: true,
      employeeId: true,
      employee: { select: { companyId: true, name: true } },
    },
  });
}

export async function editarPlano(_prev: PdiState, formData: FormData): Promise<PdiState> {
  await requireSession();
  const plano = await carregarPlano(String(formData.get("planId") ?? ""));
  if (!plano) return { error: "Plano não encontrado." };
  const title = texto(formData.get("title"), 160);
  const inicio = dia(formData.get("startDate"));
  const fim = dia(formData.get("endDate"));
  if (!title || title.length < 2) return { error: "Dê um nome ao plano." };
  if (inicio && fim && fim < inicio) return { error: "O fim do plano não pode ser antes do início." };

  await prisma.developmentPlan.update({
    where: { id: plano.id },
    data: { title, objective: texto(formData.get("objective")), startDate: inicio, endDate: fim },
  });
  refresh(plano.employee.companyId);
  return { ok: true };
}

/** Encerra o plano com um balanço, ou reabre. Encerrar tira da agenda a conversa marcada. */
export async function encerrarPlano(planId: string, status: "CONCLUIDO" | "CANCELADO" | "EM_ANDAMENTO", balanco: string): Promise<PdiState> {
  const session = await requireSession();
  const plano = await carregarPlano(planId);
  if (!plano) return { error: "Plano não encontrado." };
  if (!["CONCLUIDO", "CANCELADO", "EM_ANDAMENTO"].includes(status)) return { error: "Situação inválida." };

  if (status !== "EM_ANDAMENTO") {
    await desmarcarConversa(plano.visitId);
  }
  await prisma.developmentPlan.update({
    where: { id: planId },
    data: {
      status,
      balanco: status === "EM_ANDAMENTO" ? undefined : texto(balanco),
      ...(status === "EM_ANDAMENTO" ? {} : { proximaConversa: null, visitId: null }),
    },
  });
  const verbo = status === "CONCLUIDO" ? "Concluiu" : status === "CANCELADO" ? "Cancelou" : "Reabriu";
  await log(plano.employee.companyId, session.userId, status === "EM_ANDAMENTO" ? "REABRIU" : "CONCLUIU", plano.employeeId, `${verbo} o PDI "${plano.title}" de ${plano.employee.name}.`);
  refresh(plano.employee.companyId);
  return { ok: true };
}

export async function excluirPlano(planId: string): Promise<PdiState> {
  const session = await requireSession();
  const plano = await carregarPlano(planId);
  if (!plano) return { ok: true };
  await desmarcarConversa(plano.visitId);
  await prisma.developmentPlan.delete({ where: { id: planId } });
  await log(plano.employee.companyId, session.userId, "EXCLUIU", plano.employeeId, `Excluiu o PDI "${plano.title}" de ${plano.employee.name}.`);
  refresh(plano.employee.companyId);
  return { ok: true };
}

// ------------------------------------------------------------------ metas

export async function salvarMeta(_prev: PdiState, formData: FormData): Promise<PdiState> {
  await requireSession();
  const plano = await carregarPlano(String(formData.get("planId") ?? ""));
  if (!plano) return { error: "Plano não encontrado." };
  const metaId = String(formData.get("metaId") ?? "") || null;
  const titulo = texto(formData.get("titulo"), 300);
  if (!titulo || titulo.length < 3) return { error: "Escreva a meta: o que exatamente vai mudar." };

  const notaId = String(formData.get("notaId") ?? "") || null;
  const nota = notaId
    ? await prisma.notaDeCompetencia.findFirst({
        where: { id: notaId, avaliacao: { employeeId: plano.employeeId } },
        select: { id: true, nome: true },
      })
    : null;

  const dados = {
    titulo,
    notaId: nota?.id ?? null,
    competencia: nota?.nome ?? texto(formData.get("competencia"), 120),
    indicador: texto(formData.get("indicador")),
    recursos: texto(formData.get("recursos")),
    relevancia: texto(formData.get("relevancia")),
    prazo: dia(formData.get("prazo")),
  };

  if (metaId) {
    const { count } = await prisma.metaDoPdi.updateMany({ where: { id: metaId, planId: plano.id }, data: dados });
    if (count === 0) return { error: "Meta não encontrada." };
  } else {
    const ordem = await prisma.metaDoPdi.count({ where: { planId: plano.id } });
    await prisma.metaDoPdi.create({ data: { ...dados, planId: plano.id, ordem } });
  }
  refresh(plano.employee.companyId);
  return { ok: true };
}

export async function excluirMeta(metaId: string): Promise<PdiState> {
  await requireSession();
  const m = await prisma.metaDoPdi.findUnique({
    where: { id: metaId },
    select: { plan: { select: { employee: { select: { companyId: true } } } } },
  });
  if (!m) return { ok: true };
  await prisma.metaDoPdi.delete({ where: { id: metaId } });
  refresh(m.plan.employee.companyId);
  return { ok: true };
}

// ------------------------------------------------------------------ ações

export async function salvarAcao(_prev: PdiState, formData: FormData): Promise<PdiState> {
  await requireSession();
  const metaId = String(formData.get("metaId") ?? "");
  const acaoId = String(formData.get("acaoId") ?? "") || null;
  const meta = await prisma.metaDoPdi.findUnique({
    where: { id: metaId },
    select: { planId: true, plan: { select: { employee: { select: { companyId: true } } } } },
  });
  if (!meta) return { error: "Meta não encontrada." };
  const companyId = meta.plan.employee.companyId;

  const title = texto(formData.get("title"), 300);
  if (!title || title.length < 3) return { error: "Escreva a ação." };

  const treinamentoId = String(formData.get("treinamentoId") ?? "") || null;
  if (treinamentoId && !(await prisma.treinamento.count({ where: { id: treinamentoId, companyId } }))) {
    return { error: "Esse treinamento não é desta empresa." };
  }

  const dados = {
    title,
    tipo: treinamentoId ? "FORMAL" : lerTipoDeAcao(String(formData.get("tipo") ?? "")),
    responsavel: texto(formData.get("responsavel"), 120),
    dueDate: dia(formData.get("dueDate")),
    treinamentoId,
  };

  if (acaoId) {
    const { count } = await prisma.developmentAction.updateMany({ where: { id: acaoId, metaId }, data: dados });
    if (count === 0) return { error: "Ação não encontrada." };
  } else {
    const order = await prisma.developmentAction.count({ where: { metaId } });
    await prisma.developmentAction.create({ data: { ...dados, metaId, planId: meta.planId, order } });
  }
  refresh(companyId);
  return { ok: true };
}

/**
 * Marca o quanto a ação foi feita: 0, 25, 50, 75 ou 100%. Como o combinado
 * da reunião, só sai da cobrança quando chega a 100%.
 */
export async function marcarAcao(acaoId: string, quanto: number): Promise<PdiState> {
  const session = await requireSession();
  const a = await prisma.developmentAction.findUnique({
    where: { id: acaoId },
    select: { title: true, plan: { select: { employeeId: true, employee: { select: { companyId: true, name: true } } } } },
  });
  if (!a) return { error: "Ação não encontrada." };
  const quantoFeito = lerQuantoFeito(quanto);
  const done = quantoFeito === 100;
  await prisma.developmentAction.update({
    where: { id: acaoId },
    data: { quantoFeito, done, completedAt: done ? new Date() : null },
  });
  await log(
    a.plan.employee.companyId,
    session.userId,
    done ? "CONCLUIU" : "ATUALIZOU",
    a.plan.employeeId,
    `Marcou ${quantoFeito}% feito na ação "${a.title}" do PDI de ${a.plan.employee.name}.`,
  );
  refresh(a.plan.employee.companyId);
  return { ok: true };
}

/** Como foi a ação: o que se fez, o que faltou. */
export async function comentarAcao(acaoId: string, observacao: string): Promise<PdiState> {
  await requireSession();
  const a = await prisma.developmentAction.findUnique({
    where: { id: acaoId },
    select: { plan: { select: { employee: { select: { companyId: true } } } } },
  });
  if (!a) return { error: "Ação não encontrada." };
  await prisma.developmentAction.update({ where: { id: acaoId }, data: { observacao: texto(observacao, 2000) } });
  refresh(a.plan.employee.companyId);
  return { ok: true };
}

export async function excluirAcao(acaoId: string): Promise<PdiState> {
  await requireSession();
  const a = await prisma.developmentAction.findUnique({
    where: { id: acaoId },
    select: { plan: { select: { employee: { select: { companyId: true } } } } },
  });
  if (!a) return { ok: true };
  await prisma.developmentAction.delete({ where: { id: acaoId } });
  refresh(a.plan.employee.companyId);
  return { ok: true };
}

// --------------------------------------------------------- acompanhamento

/** Tira da agenda a conversa marcada, se ela ainda não aconteceu. */
async function desmarcarConversa(visitId: string | null) {
  if (!visitId) return;
  await prisma.visit.deleteMany({ where: { id: visitId, status: "AGENDADA" } });
}

/**
 * Marca (ou remarca) a próxima conversa: o compromisso na agenda anda junto.
 * Sem dia, desmarca.
 */
async function acertarProximaConversa(planId: string, diaDaConversa: string, hora: string, userId: string): Promise<PdiState> {
  const plano = await prisma.developmentPlan.findUnique({
    where: { id: planId },
    select: { visitId: true, visit: { select: { status: true } }, employee: { select: { companyId: true, name: true } } },
  });
  if (!plano) return { error: "Plano não encontrado." };

  if (!diaDaConversa) {
    await desmarcarConversa(plano.visitId);
    await prisma.developmentPlan.update({ where: { id: planId }, data: { proximaConversa: null, visitId: null } });
    return { ok: true };
  }
  if (!diaValido(diaDaConversa)) return { error: "Escolha o dia da próxima conversa." };
  const horario = hora || "09:00";
  if (!horaValida(horario)) return { error: "Hora inválida." };

  const data = dayKeyToDate(diaDaConversa);
  const subject = `PDI: conversa com ${plano.employee.name}`;

  // O compromisso que ainda vai acontecer é remarcado; o que já foi fica na
  // agenda como estava, e nasce outro.
  if (plano.visitId && plano.visit?.status === "AGENDADA") {
    await prisma.visit.update({ where: { id: plano.visitId }, data: { date: data, startTime: horario, subject } });
    await prisma.developmentPlan.update({ where: { id: planId }, data: { proximaConversa: data } });
    return { ok: true };
  }
  const visita = await prisma.visit.create({
    data: {
      companyId: plano.employee.companyId,
      date: data,
      startTime: horario,
      subject,
      kind: "ACOMPANHAMENTO",
      natureza: "REUNIAO",
      status: "AGENDADA",
      createdById: userId,
    },
    select: { id: true },
  });
  await prisma.developmentPlan.update({ where: { id: planId }, data: { proximaConversa: data, visitId: visita.id } });
  return { ok: true };
}

export async function marcarProximaConversa(planId: string, diaDaConversa: string, hora: string): Promise<PdiState> {
  const session = await requireSession();
  const r = await acertarProximaConversa(planId, diaDaConversa, hora, session.userId);
  const plano = await carregarPlano(planId);
  if (plano) refresh(plano.employee.companyId);
  return r;
}

type ProgressoEnviado = { metaId: string; progresso: number; status: string; comentario?: string };

/**
 * Registra a conversa de acompanhamento: o resumo, os combinados e onde cada
 * meta ficou. As metas passam a mostrar o progresso novo, a conversa marcada
 * na agenda conta como feita, e a próxima já fica marcada.
 */
export async function registrarConversa(_prev: PdiState, formData: FormData): Promise<PdiState> {
  const session = await requireSession();
  const plano = await carregarPlano(String(formData.get("planId") ?? ""));
  if (!plano) return { error: "Plano não encontrado." };

  const data = dia(formData.get("data"));
  const resumo = texto(formData.get("resumo"), 8000);
  if (!data) return { error: "Diga o dia da conversa." };
  if (!resumo) return { error: "Escreva o que foi conversado." };

  let lidos: unknown;
  try {
    lidos = JSON.parse(String(formData.get("progressos") ?? "[]"));
  } catch {
    return { error: "Não foi possível ler o progresso das metas." };
  }
  const metasDoPlano = new Set(
    (await prisma.metaDoPdi.findMany({ where: { planId: plano.id }, select: { id: true } })).map((m) => m.id),
  );
  const progressos = (Array.isArray(lidos) ? (lidos as ProgressoEnviado[]) : [])
    .filter((p) => metasDoPlano.has(String(p?.metaId)))
    .map((p) => {
      const progresso = lerProgresso(p.progresso);
      return {
        metaId: String(p.metaId),
        progresso,
        status: statusPeloProgresso(lerStatusDaMeta(String(p.status ?? "")), progresso),
        comentario: texto(p.comentario, 2000),
      };
    });

  await prisma.$transaction([
    prisma.conversaDoPdi.create({
      data: {
        planId: plano.id,
        data,
        resumo,
        combinados: texto(formData.get("combinados"), 4000),
        createdById: session.userId,
        progressos: { create: progressos },
      },
    }),
    ...progressos.map((p) =>
      prisma.metaDoPdi.update({ where: { id: p.metaId }, data: { progresso: p.progresso, status: p.status } }),
    ),
  ]);

  // A conversa marcada na agenda para até hoje aconteceu.
  if (plano.visitId) {
    await prisma.visit.updateMany({
      where: { id: plano.visitId, status: "AGENDADA", date: { lte: dayKeyToDate(todayKey()) } },
      data: { status: "REALIZADA" },
    });
  }

  const proxima = String(formData.get("proximaDia") ?? "").trim();
  if (proxima) {
    const r = await acertarProximaConversa(plano.id, proxima, String(formData.get("proximaHora") ?? ""), session.userId);
    if (r.error) return { error: `A conversa foi registrada, mas a próxima não foi marcada: ${r.error}` };
  } else {
    const atual = await prisma.developmentPlan.findUnique({ where: { id: plano.id }, select: { visit: { select: { status: true } } } });
    if (atual?.visit?.status !== "AGENDADA") {
      await prisma.developmentPlan.update({ where: { id: plano.id }, data: { proximaConversa: null, visitId: null } });
    }
  }

  await log(plano.employee.companyId, session.userId, "CRIOU", plano.employeeId, `Registrou uma conversa de PDI com ${plano.employee.name}.`);
  refresh(plano.employee.companyId);
  return { ok: true };
}

export async function excluirConversa(conversaId: string): Promise<PdiState> {
  await requireSession();
  const c = await prisma.conversaDoPdi.findUnique({
    where: { id: conversaId },
    select: { planId: true, plan: { select: { employee: { select: { companyId: true } } } } },
  });
  if (!c) return { ok: true };
  await prisma.conversaDoPdi.delete({ where: { id: conversaId } });

  // Cada meta volta ao que a conversa anterior registrou (ou fica como está,
  // se nenhuma outra falou dela).
  const metas = await prisma.metaDoPdi.findMany({
    where: { planId: c.planId },
    select: { id: true, progressos: { orderBy: { conversa: { data: "desc" } }, take: 1, select: { progresso: true, status: true } } },
  });
  await prisma.$transaction(
    metas
      .filter((m) => m.progressos.length > 0)
      .map((m) => prisma.metaDoPdi.update({ where: { id: m.id }, data: m.progressos[0] })),
  );
  refresh(c.plan.employee.companyId);
  return { ok: true };
}
