"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import { atividade } from "@/lib/atividade";
import { addDaysUTC, dateToDayKey, dayKeyToDate, momentDayKey, todayKey } from "@/lib/dates";
import { diaValido } from "@/lib/agenda";
import {
  diaDaBatida,
  DIAS_DA_SEMANA,
  horas,
  instanteNoDia,
  lerDuracao,
  lerHora,
  NOME_DA_OCORRENCIA,
  soDigitos,
  type TipoOcorrencia,
} from "@/lib/ponto";
import { lerAfd, semZerosAEsquerda } from "@/lib/ponto-afd";

/**
 * O ponto eletrônico de cada empresa cliente.
 *
 * As batidas nunca são apagadas nem alteradas: o que o RH corrige entra
 * como marcação manual, com motivo, e o que está errado é anulado, também
 * com motivo. O espelho mostra as duas coisas.
 */

export type PontoState = { error?: string; ok?: boolean; mensagem?: string };

const log = atividade("PONTO");

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}/ponto`);
}

function novoToken() {
  return randomBytes(16).toString("hex");
}

// -------------------------------------------------------------- configuração

export async function ativarPonto(companyId: string): Promise<PontoState> {
  const session = await requireSession();
  const existe = await prisma.pontoConfig.findUnique({ where: { companyId }, select: { id: true } });
  if (existe) return { ok: true };

  await prisma.pontoConfig.create({
    data: { companyId, token: novoToken(), inicio: dayKeyToDate(todayKey()) },
  });
  await log(companyId, session.userId, "CRIOU", companyId, "Ativou o ponto eletrônico.");
  refresh(companyId);
  return { ok: true };
}

function lerJornada(formData: FormData, prefixo: string): number[] | string {
  const jornada: number[] = [];
  for (let i = 0; i < 7; i++) {
    const minutos = lerDuracao(String(formData.get(`${prefixo}${i}`) ?? ""));
    if (minutos === null) return `Confira a jornada de ${DIAS_DA_SEMANA[i]} (use 8:00, 8:48, 4).`;
    jornada.push(minutos);
  }
  return jornada;
}

const configSchema = z.object({
  companyId: z.string().min(1),
  regime: z.enum(["BANCO_DE_HORAS", "HORAS_EXTRAS"]),
  tolerancia: z.coerce.number().int().min(0, "Tolerância não pode ser negativa.").max(30, "Tolerância de no máximo 30 min."),
  intervaloMinimo: z.coerce.number().int().min(0).max(240),
  validadeBancoMeses: z.coerce.number().int().min(1).max(24),
  inicio: z.string().refine(diaValido, "Diga desde quando o ponto conta."),
});

export async function salvarConfig(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = configSchema.safeParse({
    companyId: formData.get("companyId"),
    regime: formData.get("regime"),
    tolerancia: formData.get("tolerancia"),
    intervaloMinimo: formData.get("intervaloMinimo"),
    validadeBancoMeses: formData.get("validadeBancoMeses"),
    inicio: formData.get("inicio"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  const jornada = lerJornada(formData, "jornada");
  if (typeof jornada === "string") return { error: jornada };

  await prisma.pontoConfig.update({
    where: { companyId: d.companyId },
    data: {
      regime: d.regime,
      jornada,
      tolerancia: d.tolerancia,
      intervaloMinimo: d.intervaloMinimo,
      validadeBancoMeses: d.validadeBancoMeses,
      inicio: dayKeyToDate(d.inicio),
      ativo: formData.get("ativo") === "on",
    },
  });

  await log(
    d.companyId,
    session.userId,
    "ATUALIZOU",
    d.companyId,
    `Ajustou o ponto: ${d.regime === "BANCO_DE_HORAS" ? "banco de horas" : "horas extras"}, ${horas(
      jornada.reduce((s, m) => s + m, 0),
    )} semanais.`,
  );
  refresh(d.companyId);
  return { ok: true, mensagem: "Configuração salva." };
}

/** Troca o endereço do registro: o link antigo para de funcionar na hora. */
export async function trocarLink(companyId: string): Promise<PontoState> {
  const session = await requireSession();
  await prisma.pontoConfig.update({ where: { companyId }, data: { token: novoToken() } });
  await log(companyId, session.userId, "ATUALIZOU", companyId, "Trocou o link do registro de ponto.");
  refresh(companyId);
  return { ok: true };
}

// ------------------------------------------------------------------ pessoas

export async function salvarPessoa(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const employeeId = String(formData.get("employeeId") ?? "");
  const pin = String(formData.get("pin") ?? "").trim();
  const removerPin = formData.get("removerPin") === "on";
  const jornadaPropria = formData.get("jornadaPropria") === "on";
  const cpf = soDigitos(String(formData.get("cpf") ?? ""));

  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, name: true, document: true },
  });
  if (!pessoa) return { error: "Pessoa não encontrada." };

  if (cpf && cpf.length !== 11) return { error: "O CPF tem 11 números." };
  const documento = cpf || soDigitos(pessoa.document);
  if (pin && !/^\d{4,6}$/.test(pin)) return { error: "O PIN tem de 4 a 6 números." };
  if (pin && documento.length !== 11) return { error: "Informe o CPF: é com ele que a pessoa se identifica no ponto." };

  if (documento) {
    const outros = await prisma.employee.findMany({
      where: { companyId: pessoa.companyId, id: { not: employeeId }, document: { not: null } },
      select: { name: true, document: true },
    });
    const repetido = outros.find((o) => soDigitos(o.document) === documento);
    if (repetido) return { error: `Esse CPF já está com ${repetido.name}.` };
  }

  let jornada: number[] = [];
  if (jornadaPropria) {
    const lida = lerJornada(formData, "jornada");
    if (typeof lida === "string") return { error: lida };
    jornada = lida;
  }

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      ...(cpf ? { document: cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") } : {}),
      ...(pin ? { pontoPin: await hashPassword(pin) } : removerPin ? { pontoPin: null } : {}),
      pontoJornada: jornada,
    },
  });

  await log(
    pessoa.companyId,
    session.userId,
    "ATUALIZOU",
    employeeId,
    `Ajustou o ponto de ${pessoa.name}${pin ? " (PIN novo)" : removerPin ? " (PIN removido)" : ""}.`,
  );
  refresh(pessoa.companyId);
  return { ok: true, mensagem: pin ? `PIN de ${pessoa.name} gravado. Passe o PIN só para a pessoa.` : "Salvo." };
}

// --------------------------------------------------------------- marcações

const marcacaoSchema = z.object({
  employeeId: z.string().min(1),
  dia: z.string().refine(diaValido, "Escolha o dia."),
  hora: z.string().refine((v) => lerHora(v) !== null, "Confira a hora."),
  motivo: z.string().trim().min(3, "Diga por que a marcação está sendo incluída."),
});

/** O RH inclui uma batida esquecida. Fica marcada como manual, com o motivo. */
export async function incluirMarcacao(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = marcacaoSchema.safeParse({
    employeeId: formData.get("employeeId"),
    dia: formData.get("dia"),
    hora: formData.get("hora"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  const pessoa = await prisma.employee.findUnique({
    where: { id: d.employeeId },
    select: { companyId: true, name: true },
  });
  if (!pessoa) return { error: "Pessoa não encontrada." };

  const minutos = lerHora(d.hora)! + (formData.get("diaSeguinte") === "on" ? 1440 : 0);
  const momento = instanteNoDia(d.dia, minutos);
  if (momento.getTime() > Date.now()) return { error: "Não dá para incluir batida no futuro." };

  await prisma.pontoMarcacao.create({
    data: {
      companyId: pessoa.companyId,
      employeeId: d.employeeId,
      dia: dayKeyToDate(d.dia),
      momento,
      origem: "MANUAL",
      motivo: d.motivo,
      criadoPor: session.name,
    },
  });

  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    d.employeeId,
    `Incluiu batida de ${pessoa.name} em ${d.dia.split("-").reverse().join("/")} às ${d.hora}: ${d.motivo}`,
  );
  refresh(pessoa.companyId);
  return { ok: true };
}

export async function anularMarcacao(id: string, motivo: string): Promise<PontoState> {
  const session = await requireSession();
  const texto = motivo.trim();
  if (texto.length < 3) return { error: "Diga por que a batida está sendo anulada." };

  const m = await prisma.pontoMarcacao.findUnique({
    where: { id },
    select: { companyId: true, anuladaEm: true, employee: { select: { name: true } } },
  });
  if (!m) return { error: "Batida não encontrada." };
  if (m.anuladaEm) return { ok: true };

  await prisma.pontoMarcacao.update({
    where: { id },
    data: { anuladaEm: new Date(), anuladaMotivo: `${texto} (${session.name})` },
  });
  await log(m.companyId, session.userId, "ATUALIZOU", id, `Anulou uma batida de ${m.employee.name}: ${texto}`);
  refresh(m.companyId);
  return { ok: true };
}

/** Desfaz a anulação: a batida volta a contar. */
export async function restaurarMarcacao(id: string): Promise<PontoState> {
  const session = await requireSession();
  const m = await prisma.pontoMarcacao.update({
    where: { id },
    data: { anuladaEm: null, anuladaMotivo: null },
    select: { companyId: true, employee: { select: { name: true } } },
  });
  await log(m.companyId, session.userId, "ATUALIZOU", id, `Restaurou uma batida de ${m.employee.name}.`);
  refresh(m.companyId);
  return { ok: true };
}

// ------------------------------------------------------------- ocorrências

const TIPOS = ["FERIADO", "FOLGA", "FERIAS", "ABONO", "ATESTADO"] as const;

const ocorrenciaSchema = z.object({
  companyId: z.string().min(1),
  employeeId: z.string().optional().transform((v) => (v ? v : null)),
  tipo: z.enum(TIPOS),
  de: z.string().refine(diaValido, "Escolha o dia."),
  ate: z.string().optional().transform((v) => (v ? v : null)),
  descricao: z.string().trim().optional().transform((v) => (v ? v : null)),
});

/** Feriado (empresa toda) ou folga, férias, abono e atestado de uma pessoa, num dia ou num período. */
export async function salvarOcorrencia(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = ocorrenciaSchema.safeParse({
    companyId: formData.get("companyId"),
    employeeId: formData.get("employeeId") ?? undefined,
    tipo: formData.get("tipo"),
    de: formData.get("de"),
    ate: formData.get("ate") ?? undefined,
    descricao: formData.get("descricao") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  if (d.tipo !== "FERIADO" && !d.employeeId) return { error: "Escolha a pessoa." };
  if (d.tipo === "FERIADO" && d.employeeId) return { error: "Feriado vale para a empresa toda: deixe a pessoa em branco." };
  // A pessoa tem de ser desta empresa: a ocorrência não pode cair no ponto de outro cliente.
  if (d.employeeId) {
    const daEmpresa = await prisma.employee.count({ where: { id: d.employeeId, companyId: d.companyId } });
    if (!daEmpresa) return { error: "Essa pessoa não é desta empresa." };
  }
  const ate = d.ate ?? d.de;
  if (!diaValido(ate) || ate < d.de) return { error: "O fim do período vem depois do começo." };

  const dias: string[] = [];
  for (let x = dayKeyToDate(d.de); dateToDayKey(x) <= ate; x = addDaysUTC(x, 1)) dias.push(dateToDayKey(x));
  if (dias.length > 62) return { error: "Período longo demais: lance em partes de até 2 meses." };

  // Um dia tem uma ocorrência só: a nova substitui a que já estava.
  await prisma.$transaction([
    prisma.pontoOcorrencia.deleteMany({
      where: { companyId: d.companyId, employeeId: d.employeeId, dia: { in: dias.map(dayKeyToDate) } },
    }),
    prisma.pontoOcorrencia.createMany({
      data: dias.map((dia) => ({
        companyId: d.companyId,
        employeeId: d.employeeId,
        dia: dayKeyToDate(dia),
        tipo: d.tipo,
        descricao: d.descricao,
        criadoPor: session.name,
      })),
    }),
  ]);

  await log(
    d.companyId,
    session.userId,
    "CRIOU",
    d.employeeId ?? d.companyId,
    `Lançou ${NOME_DA_OCORRENCIA[d.tipo as TipoOcorrencia].toLowerCase()} no ponto (${dias.length} dia${dias.length > 1 ? "s" : ""}).`,
  );
  refresh(d.companyId);
  return { ok: true };
}

export async function excluirOcorrencia(id: string): Promise<PontoState> {
  const session = await requireSession();
  const o = await prisma.pontoOcorrencia.delete({ where: { id }, select: { companyId: true, tipo: true } });
  await log(o.companyId, session.userId, "EXCLUIU", id, `Tirou ${NOME_DA_OCORRENCIA[o.tipo].toLowerCase()} do ponto.`);
  refresh(o.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ banco de horas

const lancamentoSchema = z.object({
  employeeId: z.string().min(1),
  dia: z.string().refine(diaValido, "Escolha o dia."),
  sentido: z.enum(["CREDITO", "DEBITO"]),
  horas: z.string().refine((v) => (lerDuracao(v) ?? 0) > 0, "Diga quantas horas (ex.: 2:30)."),
  descricao: z.string().trim().min(3, "Diga o que é o lançamento."),
});

/** Saldo trazido de antes, horas pagas em folha, ajuste combinado. */
export async function lancarNoBanco(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const parsed = lancamentoSchema.safeParse({
    employeeId: formData.get("employeeId"),
    dia: formData.get("dia"),
    sentido: formData.get("sentido"),
    horas: formData.get("horas"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;

  const pessoa = await prisma.employee.findUnique({ where: { id: d.employeeId }, select: { companyId: true, name: true } });
  if (!pessoa) return { error: "Pessoa não encontrada." };

  const minutos = lerDuracao(d.horas)! * (d.sentido === "DEBITO" ? -1 : 1);
  await prisma.pontoLancamento.create({
    data: {
      companyId: pessoa.companyId,
      employeeId: d.employeeId,
      dia: dayKeyToDate(d.dia),
      minutos,
      descricao: d.descricao,
      criadoPor: session.name,
    },
  });
  await log(
    pessoa.companyId,
    session.userId,
    "CRIOU",
    d.employeeId,
    `Lançou ${minutos > 0 ? "+" : ""}${horas(minutos)} no banco de horas de ${pessoa.name}: ${d.descricao}`,
  );
  refresh(pessoa.companyId);
  return { ok: true };
}

export async function excluirLancamento(id: string): Promise<PontoState> {
  const session = await requireSession();
  const l = await prisma.pontoLancamento.delete({
    where: { id },
    select: { companyId: true, minutos: true, employee: { select: { name: true } } },
  });
  await log(l.companyId, session.userId, "EXCLUIU", id, `Excluiu um lançamento de ${horas(l.minutos)} do banco de ${l.employee.name}.`);
  refresh(l.companyId);
  return { ok: true };
}

// ------------------------------------------------------------ importar AFD

/**
 * Traz as batidas do relógio próprio da empresa pelo arquivo AFD.
 *
 * A pessoa é achada pelo CPF (ou PIS, no leiaute antigo) cadastrado na
 * Equipe. Batida que já existe no mesmo minuto é pulada: dá para importar o
 * mesmo arquivo de novo, com mais dias, sem duplicar nada.
 */
export async function importarAfd(_prev: PontoState, formData: FormData): Promise<PontoState> {
  const session = await requireSession();
  const companyId = String(formData.get("companyId") ?? "");
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: "Escolha o arquivo AFD." };
  if (arquivo.size > 20 * 1024 * 1024) return { error: "Arquivo maior que 20 MB." };

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  // O AFD da 671 é UTF-8; o antigo costuma vir em Latin-1. Só números importam aqui.
  const { marcacoes, ilegiveis } = lerAfd(bytes.toString("latin1"));
  if (marcacoes.length === 0) {
    return { error: "Nenhuma batida encontrada. Confira se é o AFD (e não o AEJ ou um relatório)." };
  }

  const pessoas = await prisma.employee.findMany({
    where: { companyId, document: { not: null } },
    select: { id: true, document: true },
  });
  const porDocumento = new Map(pessoas.map((p) => [semZerosAEsquerda(p.document!), p.id]));

  const semCadastro = new Set<string>();
  const porPessoa = new Map<string, Date[]>();
  for (const m of marcacoes) {
    const id = porDocumento.get(m.documento);
    if (!id) {
      semCadastro.add(m.documento);
      continue;
    }
    const lista = porPessoa.get(id) ?? [];
    lista.push(m.instante);
    porPessoa.set(id, lista);
  }

  let novas = 0;
  let repetidas = 0;
  for (const [employeeId, instantes] of porPessoa) {
    instantes.sort((a, b) => a.getTime() - b.getTime());
    const primeira = instantes[0];
    const existentes = await prisma.pontoMarcacao.findMany({
      where: { employeeId, momento: { gte: new Date(primeira.getTime() - 86_400_000) } },
      select: { momento: true, dia: true, anuladaEm: true },
    });
    const jaTem = new Set(existentes.map((e) => Math.floor(e.momento.getTime() / 60_000)));

    // Quantas batidas válidas cada dia de trabalho já tem, para o turno da noite fechar no dia certo.
    const porDia = new Map<string, Date[]>();
    for (const e of existentes) {
      if (e.anuladaEm) continue;
      const dia = dateToDayKey(e.dia);
      porDia.set(dia, [...(porDia.get(dia) ?? []), e.momento]);
    }

    const criar: { dia: Date; momento: Date }[] = [];
    for (const instante of instantes) {
      const minuto = Math.floor(instante.getTime() / 60_000);
      if (jaTem.has(minuto)) {
        repetidas += 1;
        continue;
      }
      jaTem.add(minuto);
      const hoje = momentDayKey(instante);
      const ontem = dateToDayKey(addDaysUTC(dayKeyToDate(hoje), -1));
      const dia = diaDaBatida({
        hoje,
        ontem,
        batidasDeOntem: porDia.get(ontem) ?? [],
        batidasDeHoje: (porDia.get(hoje) ?? []).length,
        agora: instante,
      });
      porDia.set(dia, [...(porDia.get(dia) ?? []), instante]);
      criar.push({ dia: dayKeyToDate(dia), momento: instante });
    }

    if (criar.length > 0) {
      await prisma.pontoMarcacao.createMany({
        data: criar.map((c) => ({
          companyId,
          employeeId,
          dia: c.dia,
          momento: c.momento,
          origem: "IMPORTADA" as const,
          criadoPor: session.name,
        })),
      });
      novas += criar.length;
    }
  }

  await log(companyId, session.userId, "CRIOU", companyId, `Importou ${novas} batida(s) do AFD "${arquivo.name}".`);
  refresh(companyId);

  const partes = [`${novas} batida(s) nova(s) importada(s)`];
  if (repetidas) partes.push(`${repetidas} já estavam aqui`);
  if (semCadastro.size) partes.push(`${semCadastro.size} CPF/PIS sem pessoa na Equipe: ${[...semCadastro].slice(0, 5).join(", ")}${semCadastro.size > 5 ? "…" : ""}`);
  if (ilegiveis) partes.push(`${ilegiveis} linha(s) ilegível(is)`);
  return { ok: true, mensagem: partes.join(" · ") + "." };
}
