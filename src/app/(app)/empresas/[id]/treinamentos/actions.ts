"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { diaValido, horaValida } from "@/lib/agenda";
import { dayKeyToDate, formatFullDate } from "@/lib/dates";
import { textoDoFormulario, textoSeguro } from "@/lib/texto-seguro";
import { acertarAgenda } from "@/lib/reuniao-agenda";
import {
  lerCategoria,
  lerDinheiro,
  lerHoras,
  lerModalidade,
  limparNomeDoCargo,
  mesmoCargo,
  nomeDoTreinamento,
} from "@/lib/treinamentos";
import { gerarIntegracaoDe, quemPrecisa } from "@/lib/treinamentos-dados";
import { lerNivelDeCargo } from "@/lib/cargos";

/**
 * Treinamento e desenvolvimento da empresa: cargos, catálogo, matriz, turmas
 * e o checklist de integração.
 *
 * A turma é uma reunião com dados a mais (TurmaDeTreinamento): convocados,
 * presença, pauta, apresentação e agenda são os da reunião.
 */

export type TreinoState = { error?: string; ok?: boolean; id?: string };

const log = atividade("TREINAMENTO");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
  revalidatePath("/agenda");
}

function texto(valor: FormDataEntryValue | string | null, max = 200): string {
  return textoDoFormulario(valor, max);
}

// ------------------------------------------------------------------ cargos

/** O nível (gerencial, técnico, operacional) vem da aba Cargos; nas outras telas fica para depois. */
export async function criarCargo(companyId: string, nome: string, nivel?: string): Promise<TreinoState> {
  const session = await requireSession();
  const limpo = limparNomeDoCargo(textoSeguro(nome)).slice(0, 120);
  if (limpo.length < 2) return { error: "Escreva o nome do cargo." };

  const existentes = await prisma.cargo.findMany({ where: { companyId }, select: { id: true, nome: true } });
  const igual = existentes.find((c) => mesmoCargo(c.nome, limpo));
  if (igual) return { error: `Já existe o cargo "${igual.nome}".` };
  if (!(await prisma.company.count({ where: { id: companyId } }))) return { error: "Empresa não encontrada." };

  const cargo = await prisma.cargo.create({
    data: { companyId, nome: limpo, nivel: lerNivelDeCargo(nivel) },
    select: { id: true },
  });
  await log(companyId, session.userId, "CRIOU", cargo.id, `Criou o cargo ${limpo}.`);
  refresh(companyId);
  return { ok: true, id: cargo.id };
}

/**
 * Renomeia o cargo. Se o nome novo é de outro cargo da lista, os dois viram um
 * só: as pessoas e as marcas da matriz passam para o que fica.
 */
export async function renomearCargo(cargoId: string, nome: string): Promise<TreinoState> {
  const session = await requireSession();
  const limpo = limparNomeDoCargo(textoSeguro(nome)).slice(0, 120);
  if (limpo.length < 2) return { error: "Escreva o nome do cargo." };

  const cargo = await prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true } });
  if (!cargo) return { error: "Cargo não encontrado." };
  if (cargo.nome === limpo) return { ok: true };

  const outros = await prisma.cargo.findMany({
    where: { companyId: cargo.companyId, id: { not: cargoId } },
    select: { id: true, nome: true },
  });
  const destino = outros.find((c) => mesmoCargo(c.nome, limpo));

  if (destino) {
    const marcas = await prisma.treinamentoDoCargo.findMany({ where: { cargoId }, select: { treinamentoId: true } });
    await prisma.$transaction([
      prisma.employee.updateMany({ where: { cargoId }, data: { cargoId: destino.id, role: destino.nome } }),
      prisma.treinamentoDoCargo.createMany({
        data: marcas.map((m) => ({ treinamentoId: m.treinamentoId, cargoId: destino.id })),
        skipDuplicates: true,
      }),
      prisma.cargo.delete({ where: { id: cargoId } }),
    ]);
    await log(cargo.companyId, session.userId, "ATUALIZOU", destino.id, `Juntou o cargo ${cargo.nome} com ${destino.nome}.`);
  } else {
    await prisma.$transaction([
      prisma.cargo.update({ where: { id: cargoId }, data: { nome: limpo } }),
      prisma.employee.updateMany({ where: { cargoId }, data: { role: limpo } }),
    ]);
    await log(cargo.companyId, session.userId, "ATUALIZOU", cargoId, `Renomeou o cargo ${cargo.nome} para ${limpo}.`);
  }

  refresh(cargo.companyId);
  return { ok: true };
}

/** Exclui o cargo: quem o tinha fica sem cargo, e a matriz perde a coluna. */
export async function excluirCargo(cargoId: string): Promise<TreinoState> {
  const session = await requireSession();
  const cargo = await prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true, nome: true } });
  if (!cargo) return { error: "Cargo não encontrado." };

  await prisma.$transaction([
    prisma.employee.updateMany({ where: { cargoId }, data: { cargoId: null, role: null } }),
    prisma.cargo.delete({ where: { id: cargoId } }),
  ]);
  await log(cargo.companyId, session.userId, "EXCLUIU", cargoId, `Excluiu o cargo ${cargo.nome}.`);
  refresh(cargo.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ catálogo

export async function salvarTreinamento(_prev: TreinoState, formData: FormData): Promise<TreinoState> {
  const session = await requireSession();

  const companyId = String(formData.get("companyId") ?? "");
  const treinamentoId = String(formData.get("treinamentoId") ?? "");
  const nome = texto(formData.get("nome"));
  const codigo = texto(formData.get("codigo"), 30) || null;
  const categoria = lerCategoria(String(formData.get("categoria") ?? ""));
  const cargaTexto = String(formData.get("cargaHoraria") ?? "");
  const cargaHoraria = lerHoras(cargaTexto);
  const descricao = textoSeguro(String(formData.get("descricao") ?? "")).trim() || null;

  if (nome.length < 2) return { error: "Dê um nome ao treinamento." };
  if (cargaTexto.trim() && cargaHoraria == null) return { error: "Carga horária ilegível. Ex.: 2, 2,5 ou 2h30." };
  if (!(await prisma.company.count({ where: { id: companyId } }))) return { error: "Empresa não encontrada." };

  const dados = { nome, codigo, categoria, cargaHoraria, descricao };
  if (treinamentoId) {
    const { count } = await prisma.treinamento.updateMany({ where: { id: treinamentoId, companyId }, data: dados });
    if (count === 0) return { error: "Treinamento não encontrado." };
    // As turmas ainda não realizadas acompanham o nome.
    await prisma.meeting.updateMany({
      where: { turma: { treinamentoId }, status: { in: ["PLANEJADA", "AGENDADA"] } },
      data: { title: nomeDoTreinamento({ codigo, nome }) },
    });
    await log(companyId, session.userId, "ATUALIZOU", treinamentoId, `Atualizou o treinamento ${nomeDoTreinamento(dados)}.`);
  } else {
    const criado = await prisma.treinamento.create({ data: { ...dados, companyId }, select: { id: true } });
    await log(companyId, session.userId, "CRIOU", criado.id, `Cadastrou o treinamento ${nomeDoTreinamento(dados)}.`);
  }

  refresh(companyId);
  return { ok: true };
}

/** Tira de uso (ou volta): fora de uso não aparece para programar nem gera pendência. */
export async function alternarTreinamentoAtivo(treinamentoId: string, ativo: boolean): Promise<TreinoState> {
  await requireSession();
  const t = await prisma.treinamento.update({ where: { id: treinamentoId }, data: { ativo }, select: { companyId: true } });
  refresh(t.companyId);
  return { ok: true };
}

export async function excluirTreinamento(treinamentoId: string): Promise<TreinoState> {
  const session = await requireSession();
  const t = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    select: { companyId: true, codigo: true, nome: true, _count: { select: { turmas: true } } },
  });
  if (!t) return { error: "Treinamento não encontrado." };
  if (t._count.turmas > 0) {
    return { error: `Este treinamento tem ${t._count.turmas} turma(s) e faz parte do histórico. Tire de uso em vez de excluir.` };
  }
  await prisma.treinamento.delete({ where: { id: treinamentoId } });
  await log(t.companyId, session.userId, "EXCLUIU", treinamentoId, `Excluiu o treinamento ${nomeDoTreinamento(t)}.`);
  refresh(t.companyId);
  return { ok: true };
}

/** Marca (ou desmarca) na matriz que o cargo precisa do treinamento. */
export async function marcarNaMatriz(treinamentoId: string, cargoId: string, precisa: boolean): Promise<TreinoState> {
  await requireSession();
  const [t, c] = await Promise.all([
    prisma.treinamento.findUnique({ where: { id: treinamentoId }, select: { companyId: true } }),
    prisma.cargo.findUnique({ where: { id: cargoId }, select: { companyId: true } }),
  ]);
  if (!t || !c || t.companyId !== c.companyId) return { error: "Treinamento ou cargo não encontrado." };

  if (precisa) {
    await prisma.treinamentoDoCargo.createMany({ data: [{ treinamentoId, cargoId }], skipDuplicates: true });
  } else {
    await prisma.treinamentoDoCargo.deleteMany({ where: { treinamentoId, cargoId } });
  }
  refresh(t.companyId);
  return { ok: true };
}

/**
 * Copia o catálogo de outra empresa: os treinamentos que ainda não existem
 * aqui (pelo código, ou pelo nome) e as marcas da matriz dos cargos que as
 * duas empresas têm com o mesmo nome.
 */
export async function copiarCatalogo(companyId: string, origemId: string): Promise<TreinoState & { copiados?: number }> {
  const session = await requireSession();
  if (companyId === origemId) return { error: "Escolha outra empresa." };

  const [origem, aqui, cargosAqui, empresa] = await Promise.all([
    prisma.treinamento.findMany({
      where: { companyId: origemId },
      include: { cargos: { include: { cargo: { select: { nome: true } } } } },
    }),
    prisma.treinamento.findMany({ where: { companyId }, select: { codigo: true, nome: true } }),
    prisma.cargo.findMany({ where: { companyId }, select: { id: true, nome: true } }),
    prisma.company.findUnique({ where: { id: origemId }, select: { name: true } }),
  ]);
  if (!empresa) return { error: "Empresa de origem não encontrada." };

  const jaTem = (t: { codigo: string | null; nome: string }) =>
    aqui.some((a) => (t.codigo && a.codigo === t.codigo) || mesmoCargo(a.nome, t.nome));

  // Tudo numa transação: ou o catálogo vem inteiro, ou nada muda.
  const novos = origem.filter((t) => !jaTem(t));
  await prisma.$transaction(
    novos.map((t) => {
      const cargos = t.cargos
        .map((m) => cargosAqui.find((c) => mesmoCargo(c.nome, m.cargo.nome))?.id)
        .filter((id): id is string => Boolean(id));
      return prisma.treinamento.create({
        data: {
          companyId,
          codigo: t.codigo,
          nome: t.nome,
          categoria: t.categoria,
          cargaHoraria: t.cargaHoraria,
          descricao: t.descricao,
          cargos: { create: cargos.map((cargoId) => ({ cargoId })) },
        },
        select: { id: true },
      });
    }),
  );
  const copiados = novos.length;

  await log(companyId, session.userId, "CRIOU", companyId, `Copiou ${copiados} treinamento(s) do catálogo de ${empresa.name}.`);
  refresh(companyId);
  return { ok: true, copiados };
}

// ------------------------------------------------------------------ turmas

/**
 * Programa uma turma. Com dia marcado ela já vai para a agenda e para a aba
 * Reuniões; só com o mês, fica no planejamento até ganhar dia. Os que a matriz
 * diz que precisam (e ainda não fizeram) já entram como convocados.
 */
export async function programarTurma(_prev: TreinoState, formData: FormData): Promise<TreinoState> {
  const session = await requireSession();

  const companyId = String(formData.get("companyId") ?? "");
  const treinamentoId = String(formData.get("treinamentoId") ?? "");
  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "").trim();
  const mes = String(formData.get("mes") ?? "");
  const horasTexto = String(formData.get("horas") ?? "");
  const investimentoTexto = String(formData.get("investimento") ?? "");
  const convocar = formData.get("convocar") === "on";

  const treinamento = await prisma.treinamento.findFirst({
    where: { id: treinamentoId, companyId },
    select: { id: true, codigo: true, nome: true, cargaHoraria: true },
  });
  if (!treinamento) return { error: "Escolha o treinamento." };

  const temDia = dia !== "";
  if (temDia) {
    if (!diaValido(dia)) return { error: "Dia inválido." };
    if (!horaValida(hora)) return { error: "Diga a hora." };
  } else if (!/^\d{4}-\d{2}$/.test(mes)) {
    return { error: "Diga o dia ou, se ainda não sabe, o mês previsto." };
  }
  const horas = lerHoras(horasTexto);
  if (horasTexto.trim() && horas == null) return { error: "Horas ilegíveis. Ex.: 2, 2,5 ou 2h30." };
  const investimento = lerDinheiro(investimentoTexto);

  const data = temDia ? dayKeyToDate(dia) : null;
  const mesPrevisto = temDia ? null : dayKeyToDate(`${mes}-01`);

  const ultima = await prisma.meeting.aggregate({ where: { companyId }, _max: { number: true } });
  const numero = (ultima._max.number ?? 0) + 1;

  const reuniao = await prisma.meeting.create({
    data: {
      companyId,
      number: numero,
      title: nomeDoTreinamento(treinamento),
      date: data,
      startTime: temDia ? hora : null,
      status: temDia ? "AGENDADA" : "PLANEJADA",
      kind: "Treinamento",
      location: texto(formData.get("local")) || null,
      createdById: session.userId,
      turma: {
        create: {
          companyId,
          treinamentoId,
          mesPrevisto,
          instrutor: texto(formData.get("instrutor")) || null,
          modalidade: lerModalidade(String(formData.get("modalidade") ?? "")),
          horas: horas ?? treinamento.cargaHoraria,
          investimento,
        },
      },
    },
    select: { id: true },
  });

  if (convocar) {
    const precisam = await quemPrecisa(companyId, treinamentoId);
    if (precisam.length > 0) {
      await prisma.meetingParticipant.createMany({
        data: precisam.map((p) => ({ meetingId: reuniao.id, employeeId: p.id, name: p.name })),
      });
    }
  }

  await acertarAgenda(reuniao.id, session.userId);
  await log(
    companyId,
    session.userId,
    "CRIOU",
    reuniao.id,
    `Programou a turma de ${nomeDoTreinamento(treinamento)} ${
      data ? `para ${formatFullDate(data)} às ${hora}` : `para ${mes.split("-").reverse().join("/")}`
    }.`,
  );

  refresh(companyId);
  return { ok: true, id: reuniao.id };
}

export type CampoDaTurma = "instrutor" | "modalidade" | "horas" | "investimento" | "material" | "mes";

/** Grava um dado da turma ao sair do campo, na página da reunião. */
export async function mudarCampoDaTurma(turmaId: string, campo: CampoDaTurma, valor: string): Promise<TreinoState> {
  await requireSession();
  const turma = await prisma.turmaDeTreinamento.findUnique({ where: { id: turmaId }, select: { companyId: true } });
  if (!turma) return { error: "Turma não encontrada." };

  let data: Parameters<typeof prisma.turmaDeTreinamento.update>[0]["data"];
  switch (campo) {
    case "instrutor":
      data = { instrutor: texto(valor) || null };
      break;
    case "modalidade":
      data = { modalidade: lerModalidade(valor) };
      break;
    case "horas": {
      const h = lerHoras(valor);
      if (valor.trim() && h == null) return { error: "Horas ilegíveis. Ex.: 2, 2,5 ou 2h30." };
      data = { horas: h };
      break;
    }
    case "investimento": {
      const v = lerDinheiro(valor);
      if (valor.trim() && v == null) return { error: "Valor ilegível." };
      data = { investimento: v };
      break;
    }
    case "material":
      data = { material: textoSeguro(valor).trim() || null };
      break;
    case "mes":
      if (!/^\d{4}-\d{2}$/.test(valor)) return { error: "Mês inválido." };
      data = { mesPrevisto: dayKeyToDate(`${valor}-01`) };
      break;
    default:
      return { error: "Campo inválido." };
  }

  await prisma.turmaDeTreinamento.update({ where: { id: turmaId }, data });
  refresh(turma.companyId);
  return { ok: true };
}

/**
 * A turma que não vai acontecer: com o motivo, ela conta como justificada no
 * planejamento e sai da agenda. Sem motivo, volta a valer.
 */
export async function justificarTurma(turmaId: string, motivo: string | null): Promise<TreinoState> {
  const session = await requireSession();
  const turma = await prisma.turmaDeTreinamento.findUnique({
    where: { id: turmaId },
    select: { companyId: true, meetingId: true, meeting: { select: { title: true, date: true, status: true } } },
  });
  if (!turma) return { error: "Turma não encontrada." };

  const limpo = motivo ? textoSeguro(motivo).trim() : "";
  if (motivo !== null && limpo.length < 3) return { error: "Escreva o motivo." };
  if (limpo && turma.meeting.status === "REALIZADA") return { error: "A turma já foi realizada: reabra antes." };

  await prisma.$transaction([
    prisma.turmaDeTreinamento.update({ where: { id: turmaId }, data: { justificativa: limpo || null } }),
    prisma.meeting.update({
      where: { id: turma.meetingId },
      data: { status: limpo ? "ARQUIVADA" : turma.meeting.date ? "AGENDADA" : "PLANEJADA" },
    }),
  ]);
  await acertarAgenda(turma.meetingId, session.userId);
  await log(
    turma.companyId,
    session.userId,
    "ATUALIZOU",
    turma.meetingId,
    limpo ? `Justificou a turma ${turma.meeting.title} não realizada: ${limpo}` : `Voltou a programar a turma ${turma.meeting.title}.`,
  );

  refresh(turma.companyId);
  return { ok: true };
}

/** Convoca quem a matriz diz que precisa deste treinamento e ainda não fez. */
export async function convocarQuemPrecisa(turmaId: string): Promise<TreinoState & { convocados?: number }> {
  await requireSession();
  const turma = await prisma.turmaDeTreinamento.findUnique({
    where: { id: turmaId },
    select: {
      companyId: true,
      treinamentoId: true,
      meetingId: true,
      meeting: { select: { participants: { select: { employeeId: true } } } },
    },
  });
  if (!turma) return { error: "Turma não encontrada." };

  const ja = new Set(turma.meeting.participants.map((p) => p.employeeId));
  const novos = (await quemPrecisa(turma.companyId, turma.treinamentoId)).filter((p) => !ja.has(p.id));
  if (novos.length > 0) {
    await prisma.meetingParticipant.createMany({
      data: novos.map((p) => ({ meetingId: turma.meetingId, employeeId: p.id, name: p.name })),
    });
  }
  refresh(turma.companyId);
  return { ok: true, convocados: novos.length };
}

// -------------------------------------------------------------- integração

/** Grava o checklist de integração da empresa, um item por linha. */
export async function salvarModeloDeIntegracao(companyId: string, linhas: string): Promise<TreinoState> {
  const session = await requireSession();
  const itens = linhas
    .split("\n")
    .map((l) => textoSeguro(l).replace(/^[-•*\d.)\s]+/, "").trim().slice(0, 300))
    .filter(Boolean);
  if (itens.length === 0) return { error: "Escreva ao menos um item." };
  if (!(await prisma.company.count({ where: { id: companyId } }))) return { error: "Empresa não encontrada." };

  await prisma.$transaction([
    prisma.itemDoModeloDeIntegracao.deleteMany({ where: { companyId } }),
    prisma.itemDoModeloDeIntegracao.createMany({ data: itens.map((t, ordem) => ({ companyId, texto: t, ordem })) }),
  ]);
  await log(companyId, session.userId, "ATUALIZOU", companyId, `Atualizou o checklist de integração (${itens.length} itens).`);
  refresh(companyId);
  return { ok: true };
}

/** Dá o checklist de integração a quem foi cadastrado antes de ele existir. */
export async function gerarIntegracao(employeeId: string): Promise<TreinoState> {
  await requireSession();
  const pessoa = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
  if (!pessoa) return { error: "Colaborador não encontrado." };
  await gerarIntegracaoDe(employeeId, pessoa.companyId);
  refresh(pessoa.companyId);
  return { ok: true };
}

async function empresaDaEtapa(etapaId: string) {
  const e = await prisma.etapaDeIntegracao.findUnique({
    where: { id: etapaId },
    select: { employee: { select: { companyId: true } } },
  });
  return e?.employee.companyId ?? null;
}

export async function marcarEtapaDeIntegracao(etapaId: string, feito: boolean): Promise<TreinoState> {
  await requireSession();
  const companyId = await empresaDaEtapa(etapaId);
  if (!companyId) return { error: "Item não encontrado." };
  await prisma.etapaDeIntegracao.update({ where: { id: etapaId }, data: { feito, feitoEm: feito ? new Date() : null } });
  refresh(companyId);
  return { ok: true };
}

export async function adicionarEtapaDeIntegracao(employeeId: string, textoDoItem: string): Promise<TreinoState> {
  await requireSession();
  const limpo = textoSeguro(textoDoItem).trim().slice(0, 300);
  if (limpo.length < 2) return { error: "Escreva o item." };
  const pessoa = await prisma.employee.findUnique({ where: { id: employeeId }, select: { companyId: true } });
  if (!pessoa) return { error: "Colaborador não encontrado." };
  const ultima = await prisma.etapaDeIntegracao.aggregate({ where: { employeeId }, _max: { ordem: true } });
  await prisma.etapaDeIntegracao.create({ data: { employeeId, texto: limpo, ordem: (ultima._max.ordem ?? -1) + 1 } });
  refresh(pessoa.companyId);
  return { ok: true };
}

export async function removerEtapaDeIntegracao(etapaId: string): Promise<TreinoState> {
  await requireSession();
  const companyId = await empresaDaEtapa(etapaId);
  if (!companyId) return { error: "Item não encontrado." };
  await prisma.etapaDeIntegracao.delete({ where: { id: etapaId } });
  refresh(companyId);
  return { ok: true };
}
