"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { randomUUID } from "node:crypto";
import {
  assuntosDaPauta,
  conferirHorario,
  datasDaSerie,
  diaValido,
  faixaHoraria,
  fimDaHora,
  MAXIMO_DE_REPETICOES,
  rotuloDaFrequencia,
  VALORES_DE_FREQUENCIA,
  type Frequencia,
} from "@/lib/agenda";
import { dayKeyToDate, formatFullDate } from "@/lib/dates";
import { atividade } from "@/lib/atividade";

export type AgendaState = { error?: string; ok?: boolean };

const log = atividade("AGENDA");

function refresh(companyId?: string) {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  if (companyId) revalidatePath(`/empresas/${companyId}`, "layout");
}

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const visitaSchema = z.object({
  companyId: z.string().min(1, "Escolha a empresa."),
  serviceId: opcional,
  consultantId: opcional,
  date: z.string().refine(diaValido, "Escolha uma data válida."),
  startTime: z.string().trim(),
  endTime: opcional,
  subject: opcional,
  location: opcional,
  notes: opcional,
  status: z.enum(["AGENDADA", "REALIZADA", "CANCELADA"]).default("AGENDADA"),
  kind: z
    .enum(["BRIEFING", "ACOMPANHAMENTO", "ENTREGA", "OUTRO"])
    .default("ACOMPANHAMENTO"),
  frequencia: z
    .enum(["NENHUMA", ...VALORES_DE_FREQUENCIA])
    .default("NENHUMA"),
  vezes: z.coerce.number().int().min(1).max(MAXIMO_DE_REPETICOES).default(1),
  pauta: z.string().optional().default(""),
});

function lerFormulario(formData: FormData) {
  return visitaSchema.safeParse({
    companyId: formData.get("companyId"),
    serviceId: formData.get("serviceId") ?? undefined,
    consultantId: formData.get("consultantId") ?? undefined,
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") ?? undefined,
    subject: formData.get("subject") ?? undefined,
    location: formData.get("location") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    status: formData.get("status") || "AGENDADA",
    kind: formData.get("kind") || "ACOMPANHAMENTO",
    frequencia: formData.get("frequencia") || "NENHUMA",
    vezes: formData.get("vezes") || 1,
    pauta: formData.get("pauta") ?? "",
  });
}

/**
 * Confere, do lado do servidor, o que o formulário mandou: a empresa, o
 * produto do catálogo e o consultor precisam existir. O formulário só oferece
 * os certos; isto impede que um id solto grave um compromisso quebrado.
 */
async function conferirVinculos(v: {
  companyId: string;
  serviceId: string | null;
  consultantId: string | null;
}): Promise<string | null> {
  const [empresa, produto, consultor] = await Promise.all([
    prisma.company.count({ where: { id: v.companyId } }),
    v.serviceId ? prisma.service.count({ where: { id: v.serviceId } }) : Promise.resolve(1),
    v.consultantId ? prisma.user.count({ where: { id: v.consultantId } }) : Promise.resolve(1),
  ]);
  if (!empresa) return "Empresa não encontrada.";
  if (!produto) return "Produto não encontrado no catálogo.";
  if (!consultor) return "Consultor não encontrado.";
  return null;
}

/**
 * O compromisso que nasceu de uma reunião ou de um encontro do plano leva os
 * dois junto: mudar o dia, a hora, o local ou a situação aqui muda lá.
 *
 * A reunião em preparação (PLANEJADA) acompanha só a data — ela vira reunião
 * de fato pelo "Mandar para reunião". Cancelar o compromisso não mexe na
 * situação da reunião: quem decide se ela vai acontecer é a reunião.
 */
async function acompanharReuniao(
  visitId: string,
  v: { date: Date; startTime: string; location: string | null; status: "AGENDADA" | "REALIZADA" | "CANCELADA" },
) {
  const reuniao = await prisma.meeting.findFirst({
    where: { visitId },
    select: { id: true, status: true },
  });
  if (reuniao && reuniao.status !== "ARQUIVADA") {
    const muda = reuniao.status !== "PLANEJADA" && v.status !== "CANCELADA";
    await prisma.meeting.update({
      where: { id: reuniao.id },
      data: {
        date: v.date,
        startTime: v.startTime,
        location: v.location,
        ...(muda ? { status: v.status === "REALIZADA" ? "REALIZADA" : "AGENDADA" } : {}),
      },
    });
  }
  await prisma.encontroDoPlano.updateMany({
    where: { visitId },
    data: { data: v.date, hora: v.startTime },
  });
}

export async function criarVisita(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const session = await requireSession();

  const parsed = lerFormulario(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  const erroHora = conferirHorario(d.startTime, d.endTime);
  if (erroHora) return { error: erroHora };

  const erroVinculo = await conferirVinculos(d);
  if (erroVinculo) return { error: erroVinculo };

  const repete = d.frequencia !== "NENHUMA";

  // A série é criada de uma vez, e não calculada na hora de mostrar: assim
  // cada reunião pode ser remarcada ou cancelada sozinha depois.
  const datas = repete
    ? datasDaSerie(d.date, d.frequencia as Frequencia, d.vezes)
    : [d.date];

  if (datas.length === 0) return { error: "Escolha uma data válida." };

  const seriesId = repete ? randomUUID() : null;
  const assuntos = assuntosDaPauta(d.pauta);

  const criadas = await prisma.$transaction(
    datas.map((dia) =>
      prisma.visit.create({
        data: {
          companyId: d.companyId,
          serviceId: d.serviceId,
          consultantId: d.consultantId,
          date: dayKeyToDate(dia),
          startTime: d.startTime,
          endTime: d.endTime,
          subject: d.subject,
          location: d.location,
          notes: d.notes,
          status: d.status,
          kind: d.kind,
          seriesId,
          frequencia: repete ? d.frequencia : null,
          createdById: session.userId,
          // A pauta combinada vale para toda a série.
          topics: {
            create: assuntos.map((title, i) => ({ title, order: i })),
          },
        },
        select: { id: true, date: true },
      }),
    ),
  );

  const primeira = criadas[0];

  await log(
    d.companyId,
    session.userId,
    "CRIOU",
    primeira.id,
    repete
      ? `Agendou ${criadas.length} reuniões — ${rotuloDaFrequencia(
          d.frequencia,
        ).toLowerCase()}, a partir de ${formatFullDate(primeira.date)}, ${faixaHoraria(
          d.startTime,
          d.endTime,
        )}${assuntos.length ? `, com ${assuntos.length} assunto(s) na pauta` : ""}.`
      : `Agendou ${formatFullDate(primeira.date)}, ${faixaHoraria(
          d.startTime,
          d.endTime,
        )}${assuntos.length ? `, com ${assuntos.length} assunto(s) na pauta` : ""}.`,
  );

  refresh(d.companyId);
  return { ok: true };
}

/**
 * Agendamento rápido: clicou na hora na grade da semana e escolheu a empresa.
 *
 * Marca a hora cheia inteira. O resto — assunto, local, quem vai — fica para
 * a edição, se for preciso; aqui o que importa é registrar sem tirar a pessoa
 * da tela.
 */
export async function agendarRapido(
  companyId: string,
  serviceId: string | null,
  dia: string,
  hora: string,
  termino: string | null = null,
): Promise<AgendaState> {
  const session = await requireSession();

  if (!companyId) return { error: "Escolha a empresa." };
  if (!diaValido(dia)) return { error: "Escolha uma data válida." };

  // O término é opcional; sem ele, o compromisso dura uma hora.
  const fim = termino && termino.trim() ? termino.trim() : fimDaHora(hora);
  const erroHora = conferirHorario(hora, fim);
  if (erroHora) return { error: erroHora };

  const erroVinculo = await conferirVinculos({ companyId, serviceId, consultantId: null });
  if (erroVinculo) return { error: erroVinculo };

  const visita = await prisma.visit.create({
    data: {
      companyId,
      serviceId,
      date: dayKeyToDate(dia),
      startTime: hora,
      endTime: fim,
      createdById: session.userId,
    },
    select: { id: true, date: true },
  });

  await log(
    companyId,
    session.userId,
    "CRIOU",
    visita.id,
    `Agendou ${formatFullDate(visita.date)}, ${faixaHoraria(hora, fim)}.`,
  );

  refresh(companyId);
  return { ok: true };
}

/**
 * Agendamento que abre o processo comercial.
 *
 * A primeira reunião é de briefing e fechamento, e nela a empresa ainda não é
 * cliente. Então ela nasce aqui, com o básico, marcada como PROSPECTO — e o
 * compromisso já aponta para a ficha, que é onde o briefing será digitado
 * durante a conversa.
 */
export async function agendarBriefing(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const session = await requireSession();

  const nome = String(formData.get("nome") ?? "").trim();
  if (nome.length < 2) return { error: "Escreva o nome da empresa." };

  const dia = String(formData.get("date") ?? "");
  if (!diaValido(dia)) return { error: "Escolha uma data válida." };

  const inicio = String(formData.get("startTime") ?? "").trim();
  const fim = String(formData.get("endTime") ?? "").trim() || null;
  const erroHora = conferirHorario(inicio, fim);
  if (erroHora) return { error: erroHora };

  const texto = (campo: string) => {
    const v = String(formData.get(campo) ?? "").trim();
    return v ? v : null;
  };

  const consultor = texto("consultantId");
  if (consultor && !(await prisma.user.count({ where: { id: consultor } }))) {
    return { error: "Consultor não encontrado." };
  }

  const funcionarios = Number(formData.get("employeeCount"));

  const empresa = await prisma.company.create({
    data: {
      name: nome,
      industry: texto("industry"),
      employeeCount: Number.isInteger(funcionarios) && funcionarios > 0 ? funcionarios : null,
      contactName: texto("contactName"),
      contactPhone: texto("contactPhone"),
      contactEmail: texto("contactEmail"),
      contractStatus: "PROSPECTO",
      createdById: session.userId,
    },
    select: { id: true, name: true },
  });

  const visita = await prisma.visit.create({
    data: {
      companyId: empresa.id,
      kind: "BRIEFING",
      date: dayKeyToDate(dia),
      startTime: inicio,
      endTime: fim,
      subject: texto("subject") ?? "Briefing e fechamento",
      location: texto("location"),
      notes: texto("notes"),
      consultantId: consultor,
      createdById: session.userId,
    },
    select: { id: true, date: true },
  });

  await log(
    empresa.id,
    session.userId,
    "CRIOU",
    visita.id,
    `Abriu ${empresa.name} como prospecto e agendou o briefing para ${formatFullDate(
      visita.date,
    )}, ${faixaHoraria(inicio, fim)}.`,
  );

  refresh(empresa.id);
  revalidatePath("/empresas", "layout");
  return { ok: true };
}

export async function atualizarVisita(
  _prev: AgendaState,
  formData: FormData,
): Promise<AgendaState> {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  const atual = await prisma.visit.findUnique({
    where: { id },
    select: { id: true, companyId: true, encontroDoPlano: { select: { id: true } } },
  });
  if (!atual) return { error: "Agendamento não encontrado." };

  const parsed = lerFormulario(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  const erroHora = conferirHorario(d.startTime, d.endTime);
  if (erroHora) return { error: erroHora };

  const erroVinculo = await conferirVinculos(d);
  if (erroVinculo) return { error: erroVinculo };

  // O compromisso de uma reunião ou de um plano pertence àquela empresa:
  // trocar a empresa aqui deixaria a reunião num cliente e a agenda noutro.
  if (d.companyId !== atual.companyId) {
    const reuniao = await prisma.meeting.count({ where: { visitId: id } });
    if (reuniao > 0 || atual.encontroDoPlano) {
      return {
        error: "Este compromisso é de uma reunião ou de um plano desta empresa: a empresa não pode ser trocada.",
      };
    }
  }

  const visita = await prisma.visit.update({
    where: { id },
    data: {
      companyId: d.companyId,
      serviceId: d.serviceId,
      consultantId: d.consultantId,
      date: dayKeyToDate(d.date),
      startTime: d.startTime,
      endTime: d.endTime,
      subject: d.subject,
      location: d.location,
      notes: d.notes,
      status: d.status,
      kind: d.kind,
    },
    select: { date: true, startTime: true, location: true, status: true },
  });
  await acompanharReuniao(id, visita);

  await log(
    d.companyId,
    session.userId,
    "ATUALIZOU",
    id,
    `Alterou o agendamento de ${formatFullDate(visita.date)}, ${faixaHoraria(
      d.startTime,
      d.endTime,
    )}.`,
  );

  // A empresa pode ter mudado: as duas fichas precisam recarregar.
  refresh(atual.companyId);
  refresh(d.companyId);
  return { ok: true };
}

/** Marcar como realizada ou cancelada sem abrir o formulário inteiro. */
export async function mudarStatusVisita(
  id: string,
  status: "AGENDADA" | "REALIZADA" | "CANCELADA",
) {
  const session = await requireSession();

  const visita = await prisma.visit.update({
    where: { id },
    data: { status },
    select: { companyId: true, date: true, startTime: true, location: true, status: true },
  });
  await acompanharReuniao(id, visita);

  const rotulo = {
    AGENDADA: "de volta para agendado",
    REALIZADA: "como realizado",
    CANCELADA: "como cancelado",
  }[status];

  await log(
    visita.companyId,
    session.userId,
    "ATUALIZOU",
    id,
    `Marcou o agendamento de ${formatFullDate(visita.date)} ${rotulo}.`,
  );

  refresh(visita.companyId);
}

/**
 * Tira os compromissos da agenda. A reunião que já foi realizada é histórico:
 * o compromisso dela fica. A reunião ainda por acontecer volta a ficar
 * "a agendar", com a pauta e os convocados; a em preparação no plano só perde
 * o compromisso.
 */
async function tirarCompromissos(ids: string[]): Promise<string[]> {
  const realizadas = new Set(
    (
      await prisma.meeting.findMany({
        where: { visitId: { in: ids }, status: "REALIZADA" },
        select: { visitId: true },
      })
    ).map((r) => r.visitId),
  );
  const saem = ids.filter((id) => !realizadas.has(id));
  if (saem.length === 0) return [];

  await prisma.$transaction([
    prisma.meeting.updateMany({
      where: { visitId: { in: saem }, status: "PLANEJADA" },
      data: { visitId: null },
    }),
    prisma.meeting.updateMany({
      where: { visitId: { in: saem } },
      data: { visitId: null, date: null, startTime: null },
    }),
    prisma.visit.deleteMany({ where: { id: { in: saem } } }),
  ]);
  return saem;
}

export async function excluirVisita(id: string): Promise<AgendaState> {
  const session = await requireSession();

  const visita = await prisma.visit.findUnique({
    where: { id },
    select: { companyId: true, date: true, startTime: true },
  });
  if (!visita) return { ok: true };

  const saiu = await tirarCompromissos([id]);
  if (saiu.length === 0) {
    return {
      error: "Esta reunião já foi realizada. Para apagar, exclua a reunião na aba Reuniões da empresa.",
    };
  }

  await log(
    visita.companyId,
    session.userId,
    "EXCLUIU",
    id,
    `Excluiu o agendamento de ${formatFullDate(visita.date)}, ${visita.startTime}.`,
  );

  refresh(visita.companyId);
  return { ok: true };
}

/** Marca ou desmarca um assunto da pauta. */
export async function alternarAssunto(id: string) {
  await requireSession();

  const assunto = await prisma.visitTopic.findUnique({
    where: { id },
    select: { done: true, visit: { select: { companyId: true } } },
  });
  if (!assunto) return;

  await prisma.visitTopic.update({
    where: { id },
    data: { done: !assunto.done },
  });

  refresh(assunto.visit.companyId);
}

/** Acrescenta um assunto à pauta de uma reunião já marcada. */
export async function acrescentarAssunto(
  visitId: string,
  titulo: string,
): Promise<AgendaState> {
  await requireSession();

  const limpo = titulo.trim();
  if (limpo.length < 2) return { error: "Escreva o assunto." };

  const visita = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { companyId: true, _count: { select: { topics: true } } },
  });
  if (!visita) return { error: "Agendamento não encontrado." };

  await prisma.visitTopic.create({
    data: { visitId, title: limpo, order: visita._count.topics },
  });

  refresh(visita.companyId);
  return { ok: true };
}

export async function excluirAssunto(id: string) {
  await requireSession();

  const assunto = await prisma.visitTopic.findUnique({
    where: { id },
    select: { visit: { select: { companyId: true } } },
  });
  if (!assunto) return;

  await prisma.visitTopic.delete({ where: { id } });
  refresh(assunto.visit.companyId);
}

/**
 * Exclui a série a partir de uma data.
 *
 * O que já passou fica: apagar reunião realizada apagaria histórico. Por isso
 * só saem as ocorrências do dia informado em diante (e, mesmo nelas, a que já
 * virou reunião realizada fica).
 */
export async function excluirSerie(
  seriesId: string,
  aPartirDe: string,
): Promise<AgendaState> {
  const session = await requireSession();

  if (!diaValido(aPartirDe)) return { error: "Data inválida." };

  const visitas = await prisma.visit.findMany({
    where: { seriesId, date: { gte: dayKeyToDate(aPartirDe) } },
    select: { id: true, companyId: true, company: { select: { name: true } } },
  });
  if (visitas.length === 0) return { ok: true };

  const saiu = await tirarCompromissos(visitas.map((v) => v.id));

  const companyId = visitas[0].companyId;
  await log(
    companyId,
    session.userId,
    "EXCLUIU",
    seriesId,
    `Cancelou ${saiu.length} reunião(ões) da série de ${visitas[0].company.name}, de ${formatFullDate(
      dayKeyToDate(aPartirDe),
    )} em diante.`,
  );

  refresh(companyId);
  return { ok: true };
}
