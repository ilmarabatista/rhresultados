"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { dayKeyToDate, dateToDayKey } from "@/lib/dates";
import {
  CORES_DE_TURNO,
  DIAS_CURTOS,
  diasDaSemana,
  domingosSeguidos,
  gerarSemana,
  lerFuncionamento,
  lerHora,
  segundaDaSemana,
  somarDias,
  turnoDeCostume,
  turnosSugeridos,
  diaMes,
  type DiaDaPessoa,
  type Funcionamento,
  type TipoDoDia,
} from "@/lib/escala";

/**
 * A escala da equipe: turnos, horário de funcionamento e o dia a dia de cada
 * pessoa. Fica só no RH; o ponto continua com o horário dele.
 */

export type EscalaState = { error?: string; ok?: boolean; mensagem?: string };

const log = atividade("ESCALA");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}/escala`);
}

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function paraDia(d: { employeeId: string; data: Date; tipo: TipoDoDia; turnoId: string | null; inicio: number | null; fim: number | null; intervalo: number }): DiaDaPessoa {
  return { ...d, dia: dateToDayKey(d.data) };
}

async function pessoasDaEmpresa(companyId: string, ids: string[]) {
  const achadas = await prisma.employee.findMany({
    where: { companyId, id: { in: ids } },
    select: { id: true },
  });
  return achadas.map((p) => p.id);
}

// ------------------------------------------------------------- o dia de um

const diaSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().min(1),
  dia,
  /** id do turno, FOLGA, FERIAS, ATESTADO ou vazio para limpar. */
  valor: z.string(),
});

export async function marcarDia(entrada: z.input<typeof diaSchema>): Promise<EscalaState> {
  await requireSession();
  const p = diaSchema.safeParse(entrada);
  if (!p.success) return { error: "Dados inválidos." };
  const { companyId, employeeId, valor } = p.data;
  const data = dayKeyToDate(p.data.dia);

  const pessoa = await prisma.employee.findFirst({ where: { id: employeeId, companyId }, select: { id: true } });
  if (!pessoa) return { error: "Colaborador não encontrado." };

  if (valor === "") {
    await prisma.diaDaEscala.deleteMany({ where: { employeeId, data } });
    return { ok: true };
  }

  let registro: { tipo: TipoDoDia; turnoId: string | null; inicio: number | null; fim: number | null; intervalo: number };
  if (valor === "FOLGA" || valor === "FERIAS" || valor === "ATESTADO") {
    registro = { tipo: valor, turnoId: null, inicio: null, fim: null, intervalo: 0 };
  } else {
    const turno = await prisma.turnoDaEscala.findFirst({ where: { id: valor, companyId } });
    if (!turno) return { error: "Turno não encontrado. Recarregue a página." };
    registro = { tipo: "TRABALHO", turnoId: turno.id, inicio: turno.inicio, fim: turno.fim, intervalo: turno.intervalo };
  }

  await prisma.diaDaEscala.upsert({
    where: { employeeId_data: { employeeId, data } },
    create: { companyId, employeeId, data, ...registro },
    update: registro,
  });
  return { ok: true };
}

// ------------------------------------------------------- a semana inteira

const semanaSchema = z.object({
  companyId: z.string().min(1),
  segunda: dia,
  employeeIds: z.array(z.string().min(1)).max(500),
});

/** Copia a semana anterior para esta, só nos dias ainda vazios. */
export async function copiarSemanaAnterior(entrada: z.input<typeof semanaSchema>): Promise<EscalaState> {
  const session = await requireSession();
  const p = semanaSchema.safeParse(entrada);
  if (!p.success) return { error: "Dados inválidos." };
  const { companyId } = p.data;
  const segunda = segundaDaSemana(p.data.segunda);
  const ids = await pessoasDaEmpresa(companyId, p.data.employeeIds);

  const anterior = await prisma.diaDaEscala.findMany({
    where: {
      companyId,
      employeeId: { in: ids },
      data: { gte: dayKeyToDate(somarDias(segunda, -7)), lte: dayKeyToDate(somarDias(segunda, -1)) },
    },
  });
  if (anterior.length === 0) return { error: "A semana anterior está vazia." };

  const resultado = await prisma.diaDaEscala.createMany({
    data: anterior.map((d) => ({
      companyId,
      employeeId: d.employeeId,
      data: dayKeyToDate(somarDias(dateToDayKey(d.data), 7)),
      tipo: d.tipo === "TRABALHO" ? "TRABALHO" : "FOLGA",
      turnoId: d.turnoId,
      inicio: d.inicio,
      fim: d.fim,
      intervalo: d.intervalo,
    })),
    skipDuplicates: true,
  });

  await log(companyId, session.userId, "ATUALIZOU", companyId, `Copiou a escala da semana anterior para ${diaMes(segunda)}.`);
  refresh(companyId);
  return { ok: true, mensagem: `${resultado.count} dias copiados. Férias e atestados viraram folga: confira.` };
}

/** Monta a semana no 6×1, só nos dias vazios (ver gerarSemana). */
export async function montarSemana(entrada: z.input<typeof semanaSchema>): Promise<EscalaState> {
  const session = await requireSession();
  const p = semanaSchema.safeParse(entrada);
  if (!p.success) return { error: "Dados inválidos." };
  const { companyId } = p.data;
  const segunda = segundaDaSemana(p.data.segunda);
  const ids = await pessoasDaEmpresa(companyId, p.data.employeeIds);
  if (ids.length === 0) return { error: "Ninguém na lista." };

  const [regras, turnos, historico] = await Promise.all([
    prisma.regrasDaEscala.findUnique({ where: { companyId } }),
    prisma.turnoDaEscala.findMany({ where: { companyId }, orderBy: [{ ordem: "asc" }, { inicio: "asc" }] }),
    prisma.diaDaEscala.findMany({
      where: {
        companyId,
        employeeId: { in: ids },
        data: { gte: dayKeyToDate(somarDias(segunda, -28)), lte: dayKeyToDate(somarDias(segunda, 6)) },
      },
    }),
  ]);
  if (turnos.length === 0) return { error: "Cadastre os turnos antes de montar a escala." };

  const dias = historico.map(paraDia);
  const estaSemana = new Set(diasDaSemana(segunda));
  const antes = dias.filter((d) => !estaSemana.has(d.dia));
  const domingoPassado = somarDias(segunda, -1);

  const novos = gerarSemana({
    segunda,
    pessoas: ids.map((id) => ({
      id,
      turnoId: turnoDeCostume(id, antes),
      domingosSeguidos: domingosSeguidos(id, domingoPassado, antes),
    })),
    turnos,
    funcionamento: lerFuncionamento(regras?.funcionamento),
    jaMarcados: dias.filter((d) => estaSemana.has(d.dia)),
  });
  if (novos.length === 0) return { ok: true, mensagem: "A semana já estava toda preenchida." };

  await prisma.diaDaEscala.createMany({
    data: novos.map((d) => ({
      companyId,
      employeeId: d.employeeId,
      data: dayKeyToDate(d.dia),
      tipo: d.tipo,
      turnoId: d.turnoId,
      inicio: d.inicio,
      fim: d.fim,
      intervalo: d.intervalo,
    })),
    skipDuplicates: true,
  });

  await log(companyId, session.userId, "ATUALIZOU", companyId, `Montou a escala da semana de ${diaMes(segunda)}.`);
  refresh(companyId);
  return { ok: true, mensagem: `${novos.length} dias preenchidos. Confira os avisos e ajuste o que precisar.` };
}

/** Limpa a semana das pessoas da lista. */
export async function limparSemana(entrada: z.input<typeof semanaSchema>): Promise<EscalaState> {
  const session = await requireSession();
  const p = semanaSchema.safeParse(entrada);
  if (!p.success) return { error: "Dados inválidos." };
  const { companyId } = p.data;
  const segunda = segundaDaSemana(p.data.segunda);
  const ids = await pessoasDaEmpresa(companyId, p.data.employeeIds);

  const r = await prisma.diaDaEscala.deleteMany({
    where: {
      companyId,
      employeeId: { in: ids },
      data: { gte: dayKeyToDate(segunda), lte: dayKeyToDate(somarDias(segunda, 6)) },
    },
  });
  await log(companyId, session.userId, "EXCLUIU", companyId, `Limpou a escala da semana de ${diaMes(segunda)}.`);
  refresh(companyId);
  return { ok: true, mensagem: `${r.count} dias limpos.` };
}

// ------------------------------------------------------------------ turnos

const turnoSchema = z.object({
  companyId: z.string().min(1),
  turnoId: z.string().optional(),
  nome: z.string().trim().min(1, "Dê um nome ao turno.").max(40),
  inicio: z.string(),
  fim: z.string(),
  intervalo: z.coerce.number().int().min(0, "Intervalo inválido.").max(240, "Intervalo de no máximo 4h."),
  cor: z.enum(CORES_DE_TURNO).default("azul"),
});

export async function salvarTurno(_: EscalaState, formData: FormData): Promise<EscalaState> {
  const session = await requireSession();
  const p = turnoSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Confira o turno." };
  const { companyId, turnoId, nome, intervalo, cor } = p.data;

  const inicio = lerHora(p.data.inicio);
  let fim = lerHora(p.data.fim);
  if (inicio === null || fim === null) return { error: "Escreva as horas assim: 08:00." };
  if (fim <= inicio) fim += 1440;
  if (fim - inicio - intervalo <= 0) return { error: "O intervalo é maior que o turno." };
  if (fim - inicio > 16 * 60) return { error: "Turno de mais de 16h: confira as horas." };

  if (turnoId) {
    const existe = await prisma.turnoDaEscala.findFirst({ where: { id: turnoId, companyId }, select: { id: true } });
    if (!existe) return { error: "Turno não encontrado." };
    await prisma.turnoDaEscala.update({ where: { id: turnoId }, data: { nome, inicio, fim, intervalo, cor } });
  } else {
    const ordem = await prisma.turnoDaEscala.count({ where: { companyId } });
    await prisma.turnoDaEscala.create({ data: { companyId, nome, inicio, fim, intervalo, cor, ordem } });
  }
  await log(companyId, session.userId, turnoId ? "ATUALIZOU" : "CRIOU", companyId, `Turno da escala: ${nome}.`);
  refresh(companyId);
  return {
    ok: true,
    mensagem: turnoId ? "Turno salvo. Os dias já marcados ficam com o horário antigo; marque de novo para trocar." : "Turno criado.",
  };
}

export async function excluirTurno(companyId: string, turnoId: string): Promise<EscalaState> {
  const session = await requireSession();
  const turno = await prisma.turnoDaEscala.findFirst({ where: { id: turnoId, companyId } });
  if (!turno) return { error: "Turno não encontrado." };
  // Os dias já marcados guardam o horário: continuam na escala, só sem o nome do turno.
  await prisma.turnoDaEscala.delete({ where: { id: turnoId } });
  await log(companyId, session.userId, "EXCLUIU", companyId, `Excluiu o turno da escala ${turno.nome}.`);
  refresh(companyId);
  return { ok: true };
}

export async function criarTurnosSugeridos(companyId: string): Promise<EscalaState> {
  const session = await requireSession();
  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!empresa) return { error: "Empresa não encontrada." };
  const ja = await prisma.turnoDaEscala.count({ where: { companyId } });
  if (ja > 0) return { error: "A empresa já tem turnos." };
  const regras = await prisma.regrasDaEscala.findUnique({ where: { companyId } });
  const sugeridos = turnosSugeridos(lerFuncionamento(regras?.funcionamento));
  await prisma.turnoDaEscala.createMany({
    data: sugeridos.map((t, ordem) => ({ companyId, ...t, ordem })),
  });
  await log(companyId, session.userId, "CRIOU", companyId, "Criou os turnos sugeridos da escala.");
  refresh(companyId);
  return { ok: true };
}

// ------------------------------------------------------------ funcionamento

export async function salvarFuncionamento(_: EscalaState, formData: FormData): Promise<EscalaState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!empresa) return { error: "Empresa não encontrada." };

  const funcionamento: Funcionamento = [];
  for (let i = 0; i < 7; i++) {
    if (formData.get(`fechado${i}`) === "on") {
      funcionamento.push(null);
      continue;
    }
    const abre = lerHora(String(formData.get(`abre${i}`) ?? ""));
    let fecha = lerHora(String(formData.get(`fecha${i}`) ?? ""));
    if (abre === null || fecha === null) return { error: `${DIAS_CURTOS[i]}: escreva as horas assim: 08:00.` };
    if (fecha <= abre) fecha += 1440;
    funcionamento.push([abre, fecha]);
  }
  const minimo = Number(formData.get("minimo") ?? 1);
  if (!Number.isInteger(minimo) || minimo < 0 || minimo > 50) return { error: "Mínimo de pessoas inválido." };

  await prisma.regrasDaEscala.upsert({
    where: { companyId },
    create: { companyId, funcionamento, minimo },
    update: { funcionamento, minimo },
  });
  await log(companyId, session.userId, "ATUALIZOU", companyId, "Atualizou o horário de funcionamento da escala.");
  refresh(companyId);
  return { ok: true, mensagem: "Horário salvo." };
}

