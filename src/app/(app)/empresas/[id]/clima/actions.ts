"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido } from "@/lib/agenda";
import { dayKeyToDate } from "@/lib/dates";
import { textoDoFormulario } from "@/lib/texto-seguro";
import {
  chaveDoRotulo,
  lerConclusoes,
  lerPerfil,
  lerStatus,
  lerStatusDaAcao,
  opcoesDoTexto,
  perfilPadrao,
  REGUA_PADRAO,
  type PerguntaDePerfil,
} from "@/lib/clima";
import { lerPerguntaDoFormulario, perguntasPadrao } from "@/lib/clima-dados";

/**
 * A pesquisa de clima de uma empresa: montar o ciclo, abrir e encerrar o link,
 * revisar as sugestões, escrever as conclusões e o plano de ação.
 *
 * O ciclo novo nasce como cópia do último ciclo da empresa (perguntas, perfil,
 * régua), para a comparação entre ciclos ser justa e o trabalho, menor. A
 * primeira pesquisa de uma empresa nasce das perguntas padrão da biblioteca.
 */

export type ClimaState = { error?: string; ok?: boolean; id?: string };

const log = atividade("CLIMA");

function refresh(companyId: string) {
  // Como os outros módulos da ficha: a moldura da empresa e tudo abaixo dela.
  revalidatePath(`/empresas/${companyId}`, "layout");
}

async function daPesquisa(pesquisaId: string) {
  return prisma.pesquisaDeClima.findUnique({
    where: { id: pesquisaId },
    select: { id: true, companyId: true, status: true, nome: true, _count: { select: { respostas: true } } },
  });
}

function novoToken() {
  return randomBytes(18).toString("base64url");
}

// --------------------------------------------------------------------- ciclo

export async function criarPesquisa(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  const session = await requireSession();
  const companyId = textoDoFormulario(formData.get("companyId"), 40);
  const nome = textoDoFormulario(formData.get("nome"), 80);
  if (nome.length < 2) return { error: "Dê um nome ao ciclo, como Clima 2026." };

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { employeeCount: true, branches: { select: { name: true }, orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }] } },
  });
  if (!empresa) return { error: "Empresa não encontrada." };

  const anterior = await prisma.pesquisaDeClima.findFirst({
    where: { companyId, status: { not: "HISTORICO" } },
    orderBy: { createdAt: "desc" },
    include: { perguntas: true },
  });

  let perguntas: Prisma.PerguntaDaPesquisaCreateWithoutPesquisaInput[];
  if (anterior && anterior.perguntas.length) {
    perguntas = anterior.perguntas.map((p) => ({
      pergunta: p.perguntaId ? { connect: { id: p.perguntaId } } : undefined,
      dimensao: p.dimensao,
      dimensaoOrdem: p.dimensaoOrdem,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes ?? undefined,
      maxEscolhas: p.maxEscolhas,
      enps: p.enps,
      ordem: p.ordem,
    }));
  } else {
    perguntas = await perguntasPadrao();
  }

  const ativos = await prisma.employee.count({ where: { companyId, status: "ATIVO" } });

  const nova = await prisma.pesquisaDeClima.create({
    data: {
      companyId,
      nome,
      token: novoToken(),
      convidados: ativos || empresa.employeeCount || null,
      regua: anterior?.regua ?? REGUA_PADRAO,
      introducao: anterior?.introducao ?? null,
      perfil: (anterior ? lerPerfil(anterior.perfil) : perfilPadrao(empresa.branches.map((b) => b.name))) as Prisma.InputJsonValue,
      createdById: session.userId,
      perguntas: { create: perguntas },
    },
    select: { id: true },
  });
  await log(companyId, session.userId, "CRIOU", nova.id, `Criou a pesquisa de clima ${nome}.`);
  refresh(companyId);
  redirect(`/empresas/${companyId}/clima/${nova.id}`);
}

/** Um rascunho que ficou sem nenhuma pergunta recebe as perguntas padrão. */
export async function usarPerguntasPadrao(pesquisaId: string): Promise<ClimaState> {
  const session = await requireSession();
  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa) return { error: "Pesquisa não encontrada." };
  if (pesquisa.status !== "RASCUNHO") return { error: "As perguntas só mudam com a pesquisa em rascunho." };
  if (await prisma.perguntaDaPesquisa.count({ where: { pesquisaId } })) return { error: "A pesquisa já tem perguntas." };

  const perguntas = await perguntasPadrao();
  if (perguntas.length === 0) return { error: "A biblioteca não tem perguntas padrão ativas." };
  await prisma.pesquisaDeClima.update({ where: { id: pesquisaId }, data: { perguntas: { create: perguntas } } });
  await log(pesquisa.companyId, session.userId, "ATUALIZOU", pesquisaId, `Pôs as perguntas padrão na pesquisa de clima ${pesquisa.nome}.`);
  refresh(pesquisa.companyId);
  return { ok: true };
}

/**
 * Um ciclo feito fora do sistema: só o nome, o ano e a média de cada dimensão,
 * para o comparativo já começar com o passado.
 */
export async function criarHistorico(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  const session = await requireSession();
  const companyId = textoDoFormulario(formData.get("companyId"), 40);
  const nome = textoDoFormulario(formData.get("nome"), 80);
  const ano = Number(formData.get("ano"));
  if (nome.length < 2) return { error: "Dê um nome ao ciclo, como Clima 2021." };
  if (!Number.isInteger(ano) || ano < 1990 || ano > 2100) return { error: "Informe o ano em que a pesquisa foi aplicada." };
  if (!(await prisma.company.count({ where: { id: companyId } }))) return { error: "Empresa não encontrada." };

  const medias = lerMediasDoFormulario(formData);
  if ("error" in medias) return { error: medias.error };

  const nova = await prisma.pesquisaDeClima.create({
    data: {
      companyId,
      nome,
      token: novoToken(),
      status: "HISTORICO",
      abertaEm: new Date(Date.UTC(ano, 0, 1)),
      perfil: [],
      mediasDigitadas: medias.medias,
      createdById: session.userId,
    },
    select: { id: true },
  });
  await log(companyId, session.userId, "CRIOU", nova.id, `Registrou o histórico de clima ${nome}.`);
  refresh(companyId);
  return { ok: true, id: nova.id };
}

/** Linhas "Dimensão; média" (ou com tabulação, colado de planilha). */
function lerMediasDoFormulario(formData: FormData): { error: string } | { medias: Record<string, number> } {
  const texto = textoDoFormulario(formData.get("medias"), 6000);
  const medias: Record<string, number> = {};
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const m = linha.match(/^(.+?)[\t;:|]\s*(\d{1,2}(?:[.,]\d+)?)\s*$/);
    if (!m) return { error: `Não entendi a linha "${linha.trim()}". Use: Dimensão; média.` };
    const valor = Number(m[2].replace(",", "."));
    if (valor < 0 || valor > 10) return { error: `A média de "${m[1].trim()}" precisa estar entre 0 e 10.` };
    medias[m[1].trim().slice(0, 80)] = Math.round(valor * 100) / 100;
  }
  if (Object.keys(medias).length === 0) return { error: "Escreva pelo menos uma dimensão com a média." };
  return { medias };
}

export async function salvarMediasDigitadas(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  await requireSession();
  const pesquisa = await daPesquisa(textoDoFormulario(formData.get("pesquisaId"), 40));
  if (!pesquisa || pesquisa.status !== "HISTORICO") return { error: "Ciclo de histórico não encontrado." };
  const nome = textoDoFormulario(formData.get("nome"), 80);
  const ano = Number(formData.get("ano"));
  if (nome.length < 2) return { error: "Dê um nome ao ciclo." };
  if (!Number.isInteger(ano) || ano < 1990 || ano > 2100) return { error: "Informe o ano em que a pesquisa foi aplicada." };
  const medias = lerMediasDoFormulario(formData);
  if ("error" in medias) return { error: medias.error };
  await prisma.pesquisaDeClima.update({
    where: { id: pesquisa.id },
    data: { nome, abertaEm: new Date(Date.UTC(ano, 0, 1)), mediasDigitadas: medias.medias },
  });
  refresh(pesquisa.companyId);
  return { ok: true };
}

export async function salvarConfiguracao(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  await requireSession();
  const pesquisa = await daPesquisa(textoDoFormulario(formData.get("pesquisaId"), 40));
  if (!pesquisa || pesquisa.status === "HISTORICO") return { error: "Pesquisa não encontrada." };

  const nome = textoDoFormulario(formData.get("nome"), 80);
  if (nome.length < 2) return { error: "Dê um nome ao ciclo." };
  const prazoTexto = textoDoFormulario(formData.get("prazo"), 10);
  if (prazoTexto && !diaValido(prazoTexto)) return { error: "Confira o prazo." };
  const convidadosTexto = textoDoFormulario(formData.get("convidados"), 6);
  const convidados = convidadosTexto ? Number(convidadosTexto) : null;
  if (convidados !== null && (!Number.isInteger(convidados) || convidados < 1)) return { error: "O número de convidados precisa ser um número inteiro." };
  const regua = Number(textoDoFormulario(formData.get("regua"), 5).replace(",", "."));
  if (!Number.isFinite(regua) || regua < 1 || regua > 10) return { error: "A régua precisa estar entre 1 e 10." };

  await prisma.pesquisaDeClima.update({
    where: { id: pesquisa.id },
    data: {
      nome,
      prazo: prazoTexto ? dayKeyToDate(prazoTexto) : null,
      convidados,
      regua,
      introducao: textoDoFormulario(formData.get("introducao"), 3000) || null,
    },
  });
  refresh(pesquisa.companyId);
  return { ok: true };
}

// -------------------------------------------------------------------- perfil

/** O perfil vem da tela como JSON: [{ chave?, rotulo, opcoes: "uma por linha" }]. */
export async function salvarPerfil(pesquisaId: string, linhas: { chave?: string; rotulo: string; opcoes: string }[]): Promise<ClimaState> {
  await requireSession();
  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa) return { error: "Pesquisa não encontrada." };
  if (pesquisa._count.respostas > 0) return { error: "A pesquisa já tem respostas: o perfil não pode mais mudar." };

  const perfil: PerguntaDePerfil[] = [];
  for (const l of linhas.slice(0, 8)) {
    const rotulo = textoDoFormulario(l.rotulo, 160);
    const opcoes = opcoesDoTexto(textoDoFormulario(l.opcoes, 3000)).map((o) => o.slice(0, 120)).slice(0, 30);
    if (!rotulo && opcoes.length === 0) continue;
    if (rotulo.length < 3) return { error: "Escreva a pergunta de cada item do perfil." };
    if (opcoes.length < 2) return { error: `"${rotulo}" precisa de pelo menos duas opções.` };
    const chave = l.chave && /^[a-z0-9-]{1,30}$/.test(l.chave) && !perfil.some((p) => p.chave === l.chave)
      ? l.chave
      : chaveDoRotulo(rotulo, perfil.map((p) => p.chave));
    perfil.push({ chave, rotulo, opcoes });
  }

  await prisma.pesquisaDeClima.update({ where: { id: pesquisa.id }, data: { perfil: perfil as Prisma.InputJsonValue } });
  refresh(pesquisa.companyId);
  return { ok: true };
}

// ----------------------------------------------------------------- perguntas

async function rascunho(pesquisaId: string) {
  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa) return { error: "Pesquisa não encontrada." } as const;
  if (pesquisa.status !== "RASCUNHO") return { error: "Volte a pesquisa para rascunho antes de mudar as perguntas." } as const;
  return { pesquisa } as const;
}

/** Põe ou tira da pesquisa uma pergunta da biblioteca (ou própria da empresa). */
export async function alternarPerguntaNaPesquisa(pesquisaId: string, perguntaId: string, incluir: boolean): Promise<ClimaState> {
  await requireSession();
  const r = await rascunho(pesquisaId);
  if ("error" in r) return { error: r.error };

  if (!incluir) {
    await prisma.perguntaDaPesquisa.deleteMany({ where: { pesquisaId, perguntaId } });
    refresh(r.pesquisa.companyId);
    return { ok: true };
  }

  const p = await prisma.perguntaDeClima.findUnique({
    where: { id: perguntaId },
    include: { dimensao: { select: { nome: true, ordem: true } } },
  });
  if (!p || (p.companyId && p.companyId !== r.pesquisa.companyId)) return { error: "Pergunta não encontrada." };
  if (await prisma.perguntaDaPesquisa.count({ where: { pesquisaId, perguntaId } })) return { ok: true };
  if (p.enps && (await prisma.perguntaDaPesquisa.count({ where: { pesquisaId, enps: true } }))) {
    return { error: "A pesquisa já tem a pergunta do eNPS." };
  }

  await prisma.perguntaDaPesquisa.create({
    data: {
      pesquisaId,
      perguntaId: p.id,
      dimensao: p.dimensao.nome,
      dimensaoOrdem: p.dimensao.ordem,
      enunciado: p.enunciado,
      tipo: p.tipo,
      opcoes: p.opcoes ?? undefined,
      maxEscolhas: p.maxEscolhas,
      enps: p.enps,
      ordem: p.ordem,
    },
  });
  refresh(r.pesquisa.companyId);
  return { ok: true };
}

/** Uma pergunta que só esta empresa tem: entra na biblioteca da empresa e na pesquisa. */
export async function criarPerguntaPropria(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  const session = await requireSession();
  const r = await rascunho(textoDoFormulario(formData.get("pesquisaId"), 40));
  if ("error" in r) return { error: r.error };
  const dimensaoId = textoDoFormulario(formData.get("dimensaoId"), 40);
  const dimensao = await prisma.dimensaoDeClima.findUnique({ where: { id: dimensaoId }, select: { nome: true, ordem: true } });
  if (!dimensao) return { error: "Escolha a dimensão." };
  const lido = await lerPerguntaDoFormulario(formData);
  if ("error" in lido) return { error: lido.error };

  const ultima = await prisma.perguntaDeClima.aggregate({ where: { dimensaoId }, _max: { ordem: true } });
  const ordem = (ultima._max.ordem ?? 0) + 10;
  const nova = await prisma.perguntaDeClima.create({
    data: { ...lido.dados, dimensaoId, companyId: r.pesquisa.companyId, ordem },
    select: { id: true },
  });
  await prisma.perguntaDaPesquisa.create({
    data: {
      pesquisaId: r.pesquisa.id,
      perguntaId: nova.id,
      dimensao: dimensao.nome,
      dimensaoOrdem: dimensao.ordem,
      ...lido.dados,
      ordem,
    },
  });
  await log(r.pesquisa.companyId, session.userId, "CRIOU", nova.id, `Criou uma pergunta própria na pesquisa ${r.pesquisa.nome}.`);
  refresh(r.pesquisa.companyId);
  return { ok: true };
}

/**
 * Ajusta o texto da pergunta só nesta pesquisa (o nome da empresa, um termo da
 * casa). Texto diferente conta como pergunta nova no comparativo.
 */
export async function editarPerguntaDaPesquisa(id: string, enunciado: string): Promise<ClimaState> {
  await requireSession();
  const p = await prisma.perguntaDaPesquisa.findUnique({ where: { id }, select: { pesquisaId: true } });
  if (!p) return { error: "Pergunta não encontrada." };
  const r = await rascunho(p.pesquisaId);
  if ("error" in r) return { error: r.error };
  const texto = textoDoFormulario(enunciado, 400);
  if (texto.length < 5) return { error: "Escreva a pergunta." };
  await prisma.perguntaDaPesquisa.update({ where: { id }, data: { enunciado: texto } });
  refresh(r.pesquisa.companyId);
  return { ok: true };
}

// --------------------------------------------------------------------- status

export async function mudarStatus(pesquisaId: string, para: string): Promise<ClimaState> {
  const session = await requireSession();
  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa || pesquisa.status === "HISTORICO") return { error: "Pesquisa não encontrada." };
  const destino = lerStatus(para);

  if (destino === "ABERTA") {
    const perguntas = await prisma.perguntaDaPesquisa.count({ where: { pesquisaId } });
    if (perguntas === 0) return { error: "Escolha as perguntas antes de abrir a pesquisa." };
    await prisma.pesquisaDeClima.update({
      where: { id: pesquisaId },
      data: { status: "ABERTA", encerradaEm: null, ...(pesquisa.status === "RASCUNHO" ? { abertaEm: new Date() } : {}) },
    });
    await log(pesquisa.companyId, session.userId, "ATUALIZOU", pesquisaId, `Abriu a pesquisa de clima ${pesquisa.nome}.`);
  } else if (destino === "ENCERRADA") {
    if (pesquisa.status !== "ABERTA") return { error: "Só uma pesquisa aberta pode ser encerrada." };
    await prisma.pesquisaDeClima.update({ where: { id: pesquisaId }, data: { status: "ENCERRADA", encerradaEm: new Date() } });
    await log(pesquisa.companyId, session.userId, "ATUALIZOU", pesquisaId, `Encerrou a pesquisa de clima ${pesquisa.nome}.`);
  } else if (destino === "RASCUNHO") {
    // Com resposta, mudar as perguntas estragaria o que já foi respondido.
    if (pesquisa._count.respostas > 0) return { error: "A pesquisa já tem respostas e não pode voltar a ser rascunho." };
    await prisma.pesquisaDeClima.update({ where: { id: pesquisaId }, data: { status: "RASCUNHO", abertaEm: null, encerradaEm: null } });
  } else {
    return { error: "Situação inválida." };
  }
  refresh(pesquisa.companyId);
  return { ok: true };
}

export async function excluirPesquisa(pesquisaId: string): Promise<ClimaState> {
  const session = await requireSession();
  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa) return { error: "Pesquisa não encontrada." };
  await prisma.pesquisaDeClima.delete({ where: { id: pesquisaId } });
  await log(pesquisa.companyId, session.userId, "EXCLUIU", pesquisaId, `Excluiu a pesquisa de clima ${pesquisa.nome} (${pesquisa._count.respostas} respostas).`);
  refresh(pesquisa.companyId);
  return { ok: true };
}

// ------------------------------------------------------------------ relatório

export async function salvarConclusao(pesquisaId: string, dimensao: string, texto: string): Promise<ClimaState> {
  await requireSession();
  const pesquisa = await prisma.pesquisaDeClima.findUnique({ where: { id: pesquisaId }, select: { companyId: true, conclusoes: true } });
  if (!pesquisa) return { error: "Pesquisa não encontrada." };
  const conclusoes = lerConclusoes(pesquisa.conclusoes);
  const limpo = textoDoFormulario(texto, 4000);
  if (limpo) conclusoes[dimensao.slice(0, 80)] = limpo;
  else delete conclusoes[dimensao];
  await prisma.pesquisaDeClima.update({ where: { id: pesquisaId }, data: { conclusoes } });
  refresh(pesquisa.companyId);
  return { ok: true };
}

/** Tira de uma sugestão o que identificaria alguém, ou a esconde do relatório. */
export async function revisarTexto(itemId: string, textoRevisado: string, ocultar: boolean): Promise<ClimaState> {
  await requireSession();
  const item = await prisma.itemDaResposta.findUnique({
    where: { id: itemId },
    select: { texto: true, resposta: { select: { pesquisa: { select: { companyId: true } } } } },
  });
  if (!item) return { error: "Resposta não encontrada." };
  const limpo = textoDoFormulario(textoRevisado, 4000);
  await prisma.itemDaResposta.update({
    where: { id: itemId },
    data: { textoRevisado: limpo && limpo !== item.texto ? limpo : null, ocultar },
  });
  refresh(item.resposta.pesquisa.companyId);
  return { ok: true };
}

// ------------------------------------------------------------- plano de ação

export async function salvarAcao(_prev: ClimaState, formData: FormData): Promise<ClimaState> {
  const session = await requireSession();
  const id = textoDoFormulario(formData.get("id"), 40);
  const pesquisaId = textoDoFormulario(formData.get("pesquisaId"), 40);
  const dimensao = textoDoFormulario(formData.get("dimensao"), 80);
  const descricao = textoDoFormulario(formData.get("descricao"), 1000);
  const responsavel = textoDoFormulario(formData.get("responsavel"), 120) || null;
  const prazoTexto = textoDoFormulario(formData.get("prazo"), 10);
  const status = lerStatusDaAcao(formData.get("status"));
  if (!dimensao) return { error: "Escolha a dimensão." };
  if (descricao.length < 3) return { error: "Escreva a ação." };
  if (prazoTexto && !diaValido(prazoTexto)) return { error: "Confira o prazo." };
  const prazo = prazoTexto ? dayKeyToDate(prazoTexto) : null;

  const pesquisa = await daPesquisa(pesquisaId);
  if (!pesquisa) return { error: "Pesquisa não encontrada." };

  if (id) {
    const { count } = await prisma.acaoDeClima.updateMany({ where: { id, pesquisaId }, data: { dimensao, descricao, responsavel, prazo, status } });
    if (!count) return { error: "Ação não encontrada." };
  } else {
    await prisma.acaoDeClima.create({ data: { pesquisaId, dimensao, descricao, responsavel, prazo, status } });
    await log(pesquisa.companyId, session.userId, "CRIOU", pesquisaId, `Nova ação do clima em ${dimensao}: ${descricao}`);
  }
  refresh(pesquisa.companyId);
  return { ok: true };
}

export async function mudarStatusDaAcao(id: string, status: string): Promise<ClimaState> {
  await requireSession();
  const acao = await prisma.acaoDeClima.update({
    where: { id },
    data: { status: lerStatusDaAcao(status) },
    select: { pesquisa: { select: { companyId: true } } },
  });
  refresh(acao.pesquisa.companyId);
  return { ok: true };
}

export async function excluirAcao(id: string): Promise<ClimaState> {
  await requireSession();
  const acao = await prisma.acaoDeClima.delete({ where: { id }, select: { pesquisa: { select: { companyId: true } } } });
  refresh(acao.pesquisa.companyId);
  return { ok: true };
}
