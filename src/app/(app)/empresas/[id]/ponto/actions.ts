"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { atividade } from "@/lib/atividade";
import { addDaysUTC, dateToDayKey, dayKeyToDate } from "@/lib/dates";
import { diaValido } from "@/lib/agenda";
import {
  cargaSemanal,
  DIAS_DA_SEMANA,
  horas,
  lerDuracao,
  lerHora,
  lerHorario,
  nomeDoMes,
  NOME_DA_OCORRENCIA,
  type Horario,
  type TipoOcorrencia,
} from "@/lib/ponto";
import { escreverNoPonto } from "@/lib/ponto-api";

/**
 * Os ajustes do ponto de cada empresa. As batidas moram no sistema de ponto,
 * à parte: aqui o RH valida o formulário, manda o ajuste para lá e registra
 * na atividade da empresa.
 *
 * As batidas nunca são apagadas nem alteradas: o que o RH corrige entra
 * como marcação manual, com motivo, e o que está errado é anulado, também
 * com motivo.
 */

export type PontoState = { error?: string; ok?: boolean; mensagem?: string };

const log = atividade("PONTO");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}/ponto`);
}

function lerHorarioDoForm(formData: FormData): Horario | string {
  const horario: Horario = [];
  for (let i = 0; i < 7; i++) {
    const lido = lerHorario(String(formData.get(`horario${i}`) ?? ""));
    if (typeof lido === "string") return `${DIAS_DA_SEMANA[i]}: ${lido}`;
    horario.push(lido);
  }
  return horario;
}

// ------------------------------------------------------------------- regras

const regrasSchema = z.object({
  companyId: z.string().min(1),
  regime: z.enum(["BANCO_DE_HORAS", "HORAS_EXTRAS"]),
  tolerancia: z.coerce.number().int().min(0, "Tolerância não pode ser negativa.").max(30, "Tolerância de no máximo 30 min."),
  intervaloMinimo: z.coerce.number().int().min(0).max(240),
  validadeBancoMeses: z.coerce.number().int().min(1).max(24),
  inicio: z.string().refine(diaValido, "Diga desde quando o ponto conta."),
});

export async function salvarRegras(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = regrasSchema.safeParse({
    companyId: formData.get("companyId"),
    regime: formData.get("regime"),
    tolerancia: formData.get("tolerancia"),
    intervaloMinimo: formData.get("intervaloMinimo"),
    validadeBancoMeses: formData.get("validadeBancoMeses"),
    inicio: formData.get("inicio"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const horario = lerHorarioDoForm(formData);
  if (typeof horario === "string") return { error: horario };
  if (horario.every((x) => x.length === 0)) return { error: "Informe o horário de pelo menos um dia." };

  const erro = await escreverNoPonto(d.companyId, "/regras", "PUT", {
    regime: d.regime,
    horario,
    tolerancia: d.tolerancia,
    intervaloMinimo: d.intervaloMinimo,
    validadeBancoMeses: d.validadeBancoMeses,
    inicio: d.inicio,
    ativo: formData.get("ativo") === "on",
  });
  if (erro) return { error: erro };

  await log(
    d.companyId,
    session.userId,
    "ATUALIZOU",
    d.companyId,
    `Ajustou o ponto: ${d.regime === "BANCO_DE_HORAS" ? "banco de horas" : "horas extras"}, ${horas(cargaSemanal(horario))} semanais.`,
  );
  refresh(d.companyId);
  return { ok: true, mensagem: "Regras salvas." };
}

// ------------------------------------------------------------- colaborador

export async function salvarColaborador(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const admissao = String(formData.get("admissao") ?? "");
  if (admissao && !diaValido(admissao)) return { error: "Confira a data de admissão." };

  let horario: Horario | null = null;
  if (formData.get("horarioProprio") === "on") {
    const lido = lerHorarioDoForm(formData);
    if (typeof lido === "string") return { error: lido };
    horario = lido;
  }

  const erro = await escreverNoPonto(companyId, `/colaboradores/${encodeURIComponent(colaboradorId)}`, "PUT", {
    horario,
    admissao: admissao || null,
  });
  if (erro) return { error: erro };
  await log(companyId, session.userId, "ATUALIZOU", colaboradorId, "Ajustou o horário de um colaborador no ponto.");
  refresh(companyId);
  return { ok: true, mensagem: "Salvo." };
}

// --------------------------------------------------------------- marcações

const marcacaoSchema = z.object({
  companyId: z.string().min(1),
  colaboradorId: z.string().min(1),
  dia: z.string().refine(diaValido, "Escolha o dia."),
  hora: z.string().refine((v) => lerHora(v) !== null, "Confira a hora."),
  motivo: z.string().trim().min(3, "Diga por que a marcação está sendo incluída."),
});

/** O RH completa uma batida que faltou. Fica marcada como manual, com o motivo. */
export async function incluirMarcacao(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = marcacaoSchema.safeParse({
    companyId: formData.get("companyId"),
    colaboradorId: formData.get("colaboradorId"),
    dia: formData.get("dia"),
    hora: formData.get("hora"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const minutos = lerHora(d.hora)! + (formData.get("diaSeguinte") === "on" ? 1440 : 0);

  const erro = await escreverNoPonto(d.companyId, "/marcacoes", "POST", {
    colaboradorId: d.colaboradorId,
    dia: d.dia,
    minutos,
    motivo: d.motivo,
    autor: session.name,
  });
  if (erro) return { error: erro };

  await log(
    d.companyId,
    session.userId,
    "CRIOU",
    d.colaboradorId,
    `Incluiu batida em ${d.dia.split("-").reverse().join("/")} às ${d.hora}: ${d.motivo}`,
  );
  refresh(d.companyId);
  return { ok: true };
}

export async function anularMarcacao(companyId: string, id: string, motivo: string): Promise<PontoState> {
  const session = await requireSession();
  const texto = motivo.trim();
  if (texto.length < 3) return { error: "Diga por que a batida está sendo anulada." };
  const erro = await escreverNoPonto(companyId, `/marcacoes/${encodeURIComponent(id)}/anular`, "POST", {
    motivo: texto,
    autor: session.name,
  });
  if (erro) return { error: erro };
  await log(companyId, session.userId, "ATUALIZOU", id, `Anulou uma batida: ${texto}`);
  refresh(companyId);
  return { ok: true };
}

/** Desfaz a anulação: a batida volta a contar. */
export async function restaurarMarcacao(companyId: string, id: string): Promise<PontoState> {
  const session = await requireSession();
  const erro = await escreverNoPonto(companyId, `/marcacoes/${encodeURIComponent(id)}/restaurar`, "POST", {});
  if (erro) return { error: erro };
  await log(companyId, session.userId, "ATUALIZOU", id, "Restaurou uma batida anulada.");
  refresh(companyId);
  return { ok: true };
}

// ------------------------------------------------------------- ocorrências

const TIPOS = ["FERIADO", "FOLGA", "FERIAS", "ABONO", "ATESTADO"] as const;

const ocorrenciaSchema = z.object({
  companyId: z.string().min(1),
  colaboradorId: z.string().optional().transform((v) => (v ? v : null)),
  tipo: z.enum(TIPOS),
  de: z.string().refine(diaValido, "Escolha o dia."),
  ate: z.string().optional().transform((v) => (v ? v : null)),
  descricao: z.string().trim().optional().transform((v) => (v ? v : null)),
});

/** Feriado (empresa toda) ou folga, férias, abono e atestado de um colaborador, num dia ou num período. */
export async function salvarOcorrencia(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = ocorrenciaSchema.safeParse({
    companyId: formData.get("companyId"),
    colaboradorId: formData.get("colaboradorId") ?? undefined,
    tipo: formData.get("tipo"),
    de: formData.get("de"),
    ate: formData.get("ate") ?? undefined,
    descricao: formData.get("descricao") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  if (d.tipo !== "FERIADO" && !d.colaboradorId) return { error: "Escolha o colaborador." };
  if (d.tipo === "FERIADO" && d.colaboradorId) return { error: "Feriado vale para a empresa toda: deixe o colaborador em branco." };
  const ate = d.ate ?? d.de;
  if (!diaValido(ate) || ate < d.de) return { error: "O fim do período vem depois do começo." };

  const dias: string[] = [];
  for (let x = dayKeyToDate(d.de); dateToDayKey(x) <= ate; x = addDaysUTC(x, 1)) dias.push(dateToDayKey(x));
  if (dias.length > 62) return { error: "Período longo demais: lance em partes de até 2 meses." };

  const erro = await escreverNoPonto(d.companyId, "/ocorrencias", "POST", {
    colaboradorId: d.colaboradorId,
    tipo: d.tipo,
    dias,
    descricao: d.descricao,
    autor: session.name,
  });
  if (erro) return { error: erro };

  await log(
    d.companyId,
    session.userId,
    "CRIOU",
    d.colaboradorId ?? d.companyId,
    `Lançou ${NOME_DA_OCORRENCIA[d.tipo as TipoOcorrencia].toLowerCase()} no ponto (${dias.length} dia${dias.length > 1 ? "s" : ""}).`,
  );
  refresh(d.companyId);
  return { ok: true };
}

export async function excluirOcorrencia(companyId: string, id: string): Promise<PontoState> {
  const session = await requireSession();
  const erro = await escreverNoPonto(companyId, `/ocorrencias/${encodeURIComponent(id)}`, "DELETE");
  if (erro) return { error: erro };
  await log(companyId, session.userId, "EXCLUIU", id, "Tirou uma ocorrência do ponto.");
  refresh(companyId);
  return { ok: true };
}

// ------------------------------------------------------------ banco de horas

const lancamentoSchema = z.object({
  companyId: z.string().min(1),
  colaboradorId: z.string().min(1),
  dia: z.string().refine(diaValido, "Escolha o dia."),
  sentido: z.enum(["CREDITO", "DEBITO"]),
  horas: z.string().refine((v) => (lerDuracao(v) ?? 0) > 0, "Diga quantas horas (ex.: 2:30)."),
  descricao: z.string().trim().min(3, "Diga o que é o lançamento."),
});

/** Saldo trazido de antes, horas pagas em folha, ajuste combinado. */
export async function lancarNoBanco(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = lancamentoSchema.safeParse({
    companyId: formData.get("companyId"),
    colaboradorId: formData.get("colaboradorId"),
    dia: formData.get("dia"),
    sentido: formData.get("sentido"),
    horas: formData.get("horas"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  const minutos = lerDuracao(d.horas)! * (d.sentido === "DEBITO" ? -1 : 1);

  const erro = await escreverNoPonto(d.companyId, "/lancamentos", "POST", {
    colaboradorId: d.colaboradorId,
    dia: d.dia,
    minutos,
    descricao: d.descricao,
    autor: session.name,
  });
  if (erro) return { error: erro };
  await log(d.companyId, session.userId, "CRIOU", d.colaboradorId, `Lançou ${minutos > 0 ? "+" : ""}${horas(minutos)} no banco de horas: ${d.descricao}`);
  refresh(d.companyId);
  return { ok: true };
}

export async function excluirLancamento(companyId: string, id: string): Promise<PontoState> {
  const session = await requireSession();
  const erro = await escreverNoPonto(companyId, `/lancamentos/${encodeURIComponent(id)}`, "DELETE");
  if (erro) return { error: erro };
  await log(companyId, session.userId, "EXCLUIU", id, "Excluiu um lançamento do banco de horas.");
  refresh(companyId);
  return { ok: true };
}

// ---------------------------------------------------------------- relatório

/** Manda o espelho do mês para o colaborador conferir no aplicativo do ponto. */
export async function enviarRelatorio(companyId: string, colaboradorId: string, mes: string): Promise<PontoState> {
  const session = await requireSession();
  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "Mês inválido." };
  const erro = await escreverNoPonto(companyId, "/relatorios", "POST", { colaboradorId, mes, autor: session.name });
  if (erro) return { error: erro };
  await log(companyId, session.userId, "CRIOU", colaboradorId, `Enviou o relatório de ponto de ${nomeDoMes(mes)} ao colaborador.`);
  refresh(companyId);
  return { ok: true, mensagem: "Relatório enviado. O colaborador vê no aplicativo do ponto." };
}
