"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { apagarComPermissao } from "@/lib/respostas-protegidas-dados";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido } from "@/lib/agenda";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import { textoDoFormulario } from "@/lib/texto-seguro";
import { organizarMapeamento, sugerirItens } from "@/lib/ai-mapeamento";
import { novoToken } from "@/lib/autoavaliacao-envio";
import {
  chaveDoTexto,
  itensSemIA,
  juntarRascunho,
  lerDados,
  mapeamentoVazio,
  type DadosDoMapeamento,
  type ItemSugerido,
  type TipoSugerido,
} from "@/lib/mapeamento";

/**
 * Mapeamento de rotinas: a entrevista do RH com a pessoa, o rascunho da IA a
 * partir da transcrição, os itens que vão para a autoavaliação da função e as
 * metas que vão para o PDI.
 */

/** `respostas`: o que se perde respondido por link; a tela pergunta e chama de novo. */
export type MapeamentoState = { error?: string; ok?: boolean; id?: string; respostas?: string };

const log = atividade("MAPEAMENTO");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
}

function dia(valor: string | null | undefined): Date | null {
  const v = String(valor ?? "").trim();
  return diaValido(v) ? dayKeyToDate(v) : null;
}

function erroDaIA(e: unknown): string {
  return e instanceof Error ? e.message : "A IA não respondeu. Tente de novo.";
}

async function carregar(mapId: string) {
  return prisma.mapeamentoDeRotina.findUnique({
    where: { id: mapId },
    select: { id: true, companyId: true, employeeId: true, dados: true, respondidoEm: true, employee: { select: { name: true } } },
  });
}

export async function criarMapeamento(employeeId: string, porLink = false): Promise<MapeamentoState & { token?: string }> {
  const session = await requireSession();
  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, name: true, role: true, department: true },
  });
  if (!pessoa) return { error: "Pessoa não encontrada." };

  const m = await prisma.mapeamentoDeRotina.create({
    data: {
      companyId: pessoa.companyId,
      employeeId,
      dataDaEntrevista: dayKeyToDate(todayKey()),
      entrevistador: session.name,
      dados: mapeamentoVazio({ cargo: pessoa.role ?? "", setor: pessoa.department ?? "" }),
      ...(porLink ? { token: novoToken(), status: "ENVIADO", enviadoEm: new Date() } : {}),
    },
    select: { id: true, token: true },
  });
  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    employeeId,
    porLink
      ? `Gerou o link do mapeamento de rotinas para ${pessoa.name} preencher.`
      : `Começou o mapeamento de rotinas de ${pessoa.name}.`,
  );
  refresh(pessoa.companyId);
  return { ok: true, id: m.id, token: m.token ?? undefined };
}

/**
 * O link de um mapeamento que já existe: a pessoa recebe o que o RH já
 * escreveu (sem as observações do RH) e completa. Depois de respondido, gerar
 * de novo reabre o mesmo link para ela corrigir.
 */
export async function linkDoMapeamento(mapId: string): Promise<MapeamentoState & { token?: string }> {
  const session = await requireSession();
  const m = await prisma.mapeamentoDeRotina.findUnique({
    where: { id: mapId },
    select: { id: true, companyId: true, employeeId: true, token: true, employee: { select: { name: true } } },
  });
  if (!m) return { error: "Mapeamento não encontrado." };
  const token = m.token ?? novoToken();
  await prisma.mapeamentoDeRotina.update({
    where: { id: mapId },
    data: { token, status: "ENVIADO", enviadoEm: new Date(), respondidoEm: null },
  });
  await log(m.companyId, session.userId, "EDITOU", m.employeeId, `Mandou o link do mapeamento de rotinas para ${m.employee.name}.`);
  refresh(m.companyId);
  return { ok: true, id: m.id, token };
}

export type CabecalhoDoMapeamento = {
  dataDaEntrevista: string;
  entrevistador: string;
  versao: string;
  proximaRevisao: string;
};

export async function salvarMapeamento(
  mapId: string,
  cabecalho: CabecalhoDoMapeamento,
  dados: DadosDoMapeamento,
): Promise<MapeamentoState> {
  await requireSession();
  const m = await carregar(mapId);
  if (!m) return { error: "Mapeamento não encontrado." };

  await prisma.mapeamentoDeRotina.update({
    where: { id: mapId },
    data: {
      dataDaEntrevista: dia(cabecalho.dataDaEntrevista),
      entrevistador: textoDoFormulario(cabecalho.entrevistador, 120) || null,
      versao: textoDoFormulario(cabecalho.versao, 20) || "1.0",
      proximaRevisao: dia(cabecalho.proximaRevisao),
      dados: lerDados(dados),
    },
  });
  refresh(m.companyId);
  return { ok: true };
}

export async function excluirMapeamento(mapId: string, apagarRespostas = false): Promise<MapeamentoState> {
  const session = await requireSession();
  const m = await carregar(mapId);
  if (!m) return { ok: true };
  if (m.respondidoEm && !apagarRespostas) return { respostas: `o mapeamento que ${m.employee.name} enviou` };
  await apagarComPermissao([prisma.mapeamentoDeRotina.delete({ where: { id: mapId } })]);
  await log(m.companyId, session.userId, "EXCLUIU", m.employeeId, `Excluiu um mapeamento de rotinas de ${m.employee.name}.`);
  refresh(m.companyId);
  return { ok: true };
}

/**
 * O rascunho da IA a partir da transcrição, juntado ao que está na tela. Não
 * grava: o RH revisa e salva.
 */
export async function preencherPelaTranscricao(
  mapId: string,
  transcricao: string,
  atual: DadosDoMapeamento,
): Promise<MapeamentoState & { dados?: DadosDoMapeamento }> {
  await requireSession();
  const m = await carregar(mapId);
  if (!m) return { error: "Mapeamento não encontrado." };
  const t = textoDoFormulario(transcricao, 60_000);
  if (t.length < 40) return { error: "Cole a transcrição ou as anotações da entrevista." };

  const tela = lerDados(atual);
  try {
    const daIA = await organizarMapeamento({ cargo: tela.cargo, setor: tela.setor }, t);
    return { ok: true, dados: juntarRascunho(tela, daIA) };
  } catch (e) {
    return { error: erroDaIA(e) };
  }
}

/** Os itens que o mapeamento salvo sugere para a autoavaliação. Sem IA, cada tarefa vira um item. */
export async function sugerirItensDoMapeamento(
  mapId: string,
  usarIA: boolean,
): Promise<MapeamentoState & { itens?: ItemSugerido[] }> {
  await requireSession();
  const m = await carregar(mapId);
  if (!m) return { error: "Mapeamento não encontrado." };
  const d = lerDados(m.dados);
  if (!usarIA) {
    const itens = itensSemIA(d);
    return itens.length ? { ok: true, itens } : { error: "O mapeamento ainda não tem tarefas." };
  }
  if (!d.tarefas.length && !d.passos.length) return { error: "Preencha as tarefas ou o passo a passo e salve antes." };
  try {
    const itens = await sugerirItens(d);
    return itens.length ? { ok: true, itens } : { error: "A IA não sugeriu nenhum item. Tente de novo." };
  } catch (e) {
    return { error: erroDaIA(e) };
  }
}

const TIPOS_QUE_ENTRAM: readonly TipoSugerido[] = ["TECNICA", "TAREFA", "COMPORTAMENTAL"];

/**
 * Leva os itens marcados para o modelo de autoavaliação: cada um no fim da
 * sua seção, pulando o que o modelo já tem com o mesmo texto. Com modeloId
 * vazio, cria um modelo novo com o nome da função.
 */
export async function levarItensParaOModelo(
  mapId: string,
  modeloId: string,
  nomeDoModeloNovo: string,
  itens: { tipo: string; texto: string }[],
): Promise<MapeamentoState & { incluidos?: number; repetidos?: number }> {
  const session = await requireSession();
  const m = await carregar(mapId);
  if (!m) return { error: "Mapeamento não encontrado." };

  const validos = itens.flatMap((i) => {
    const tipo = TIPOS_QUE_ENTRAM.find((t) => t === i.tipo);
    const texto = textoDoFormulario(i.texto, 500);
    return tipo && texto.length >= 3 ? [{ tipo, texto }] : [];
  });
  if (!validos.length) return { error: "Marque pelo menos um item." };

  let modelo = modeloId
    ? await prisma.modeloDeAutoavaliacao.findFirst({ where: { id: modeloId, companyId: m.companyId }, select: { id: true, nome: true } })
    : null;
  if (modeloId && !modelo) return { error: "Modelo não encontrado." };
  if (!modelo) {
    const nome = textoDoFormulario(nomeDoModeloNovo, 120);
    if (nome.length < 2) return { error: "Dê um nome ao modelo novo." };
    modelo = await prisma.modeloDeAutoavaliacao.create({ data: { companyId: m.companyId, nome }, select: { id: true, nome: true } });
  }

  const existentes = await prisma.perguntaDeAutoavaliacao.findMany({
    where: { modeloId: modelo.id },
    select: { texto: true },
  });
  const ja = new Set(existentes.map((p) => chaveDoTexto(p.texto)));
  const ultima = await prisma.perguntaDeAutoavaliacao.aggregate({ where: { modeloId: modelo.id }, _max: { ordem: true } });
  let ordem = (ultima._max.ordem ?? -1) + 1;

  const novos = validos.filter((i) => {
    const chave = chaveDoTexto(i.texto);
    if (ja.has(chave)) return false;
    ja.add(chave);
    return true;
  });
  if (novos.length) {
    await prisma.perguntaDeAutoavaliacao.createMany({
      data: novos.map((i) => ({ modeloId: modelo.id, tipo: i.tipo, texto: i.texto, ordem: ordem++ })),
    });
    await prisma.modeloDeAutoavaliacao.update({ where: { id: modelo.id }, data: { updatedAt: new Date() } });
  }
  await log(
    m.companyId,
    session.userId,
    "EDITOU",
    m.employeeId,
    `Levou ${novos.length} item(ns) do mapeamento de ${m.employee.name} para a autoavaliação "${modelo.nome}".`,
  );
  refresh(m.companyId);
  return { ok: true, id: modelo.id, incluidos: novos.length, repetidos: validos.length - novos.length };
}

/** Uma sugestão do mapeamento vira meta no PDI em andamento da pessoa. */
export async function metaDoMapeamento(planId: string, titulo: string, origem: string): Promise<MapeamentoState> {
  await requireSession();
  const plano = await prisma.developmentPlan.findUnique({
    where: { id: planId },
    select: { id: true, endDate: true, employee: { select: { companyId: true } } },
  });
  if (!plano) return { error: "Plano não encontrado." };
  const t = textoDoFormulario(titulo, 300);
  if (t.length < 3) return { error: "A meta está vazia." };

  const ordem = await prisma.metaDoPdi.count({ where: { planId } });
  await prisma.metaDoPdi.create({
    data: {
      planId,
      titulo: t,
      competencia: `Mapeamento de rotinas · ${textoDoFormulario(origem, 40) || "sugestão"}`,
      prazo: plano.endDate,
      ordem,
    },
  });
  refresh(plano.employee.companyId);
  return { ok: true };
}
