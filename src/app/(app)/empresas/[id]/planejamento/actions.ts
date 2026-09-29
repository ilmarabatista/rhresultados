"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { diaValido, horaValida } from "@/lib/agenda";
import { dateToDayKey, dayKeyToDate, formatFullDate } from "@/lib/dates";
import { textoSeguro } from "@/lib/texto-seguro";
import { atividade } from "@/lib/atividade";
import { acertarAgenda } from "@/lib/reuniao-agenda";
import { codigoDaReuniao } from "@/lib/reunioes";
import { datasDoPlano, lerPeriodicidade, lerTemas, proximaData, type Periodicidade } from "@/lib/planos";

/**
 * O plano de treinamento da empresa.
 *
 * O plano é o que foi prometido: produto, objetivo, periodicidade, temas e as
 * filiais onde vai acontecer, cada uma com as suas datas. O plano só planeja:
 * cada encontro vai para a agenda pelo botão "Mandar para a agenda", e vira
 * reunião (pauta e ata) na agenda, pelo "Mandar para reunião". Assim a aba
 * Reuniões só recebe o que vai acontecer de fato.
 *
 * Antes disso, cada encontro pode ser preparado ("Preparar"): ganha a mesma
 * página de uma reunião — pauta, participantes, ata e apresentação — com a
 * situação PLANEJADA, que fica fora da aba Reuniões até ir para reunião.
 */

export type PlanoState = { error?: string; ok?: boolean; id?: string };

const log = atividade("PLANO");

/** A chave do formulário para "a empresa toda" (sem filial). */
const EMPRESA = "EMPRESA";

function refresh(companyId: string) {
  revalidatePath(`/empresas/${companyId}`, "layout");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
}

function texto(v: FormDataEntryValue | null): string {
  return textoSeguro(String(v ?? "")).trim();
}

function assunto(plano: string, tema: string) {
  return `${plano}: ${tema}`;
}

/** A filial só vale se for desta empresa; "EMPRESA" ou vazio é a empresa toda. */
async function filialDaEmpresa(companyId: string, valor: string): Promise<string | null | undefined> {
  if (!valor || valor === EMPRESA) return null;
  const achadas = await prisma.branch.count({ where: { id: valor, companyId } });
  return achadas > 0 ? valor : undefined;
}

async function carregarEncontro(id: string) {
  return prisma.encontroDoPlano.findUnique({
    where: { id },
    include: {
      plano: { select: { id: true, companyId: true, titulo: true, periodicidade: true, horario: true, serviceId: true } },
      branch: { select: { name: true } },
      visit: { select: { id: true, status: true } },
      meeting: { select: { id: true, status: true } },
    },
  });
}

// ------------------------------------------------------------------ criar

export async function criarPlano(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const companyId = String(formData.get("companyId") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const titulo = texto(formData.get("titulo"));
  const objetivo = texto(formData.get("objetivo"));
  const periodicidade = lerPeriodicidade(formData.get("periodicidade"));
  const temas = lerTemas(texto(formData.get("temas")));
  const filiais = formData.getAll("filial").map(String);

  if (!serviceId) return { error: "Escolha o produto a que o plano pertence." };
  if (titulo.length < 2) return { error: "Dê um nome ao plano." };
  if (objetivo.length < 3) return { error: "Escreva o objetivo do plano." };
  if (temas.length === 0) return { error: "Escreva ao menos um tema — um por linha, um encontro cada." };
  if (temas.length > 60) return { error: "São no máximo 60 temas por plano." };
  if (filiais.length === 0) return { error: "Escolha onde o plano vai acontecer." };

  const [empresa, produto] = await Promise.all([
    prisma.company.count({ where: { id: companyId } }),
    prisma.service.count({ where: { id: serviceId } }),
  ]);
  if (!empresa) return { error: "Empresa não encontrada." };
  if (!produto) return { error: "Produto não encontrado." };

  // Cada filial com a sua primeira data e o seu horário.
  const locais: { branchId: string | null; datas: (string | null)[]; hora: string | null }[] = [];
  for (const f of filiais) {
    const branchId = await filialDaEmpresa(companyId, f);
    if (branchId === undefined) return { error: "Uma das filiais escolhidas não é desta empresa." };
    const inicio = String(formData.get(`inicio-${f}`) ?? "");
    const hora = String(formData.get(`hora-${f}`) ?? "").trim();
    if (periodicidade !== "LIVRE") {
      if (!diaValido(inicio)) return { error: "Escolha a data do primeiro encontro em cada filial." };
      if (!horaValida(hora)) return { error: "Diga o horário em cada filial." };
    }
    locais.push({
      branchId,
      datas: datasDoPlano(diaValido(inicio) ? inicio : "2000-01-01", periodicidade, temas.length).map((d) =>
        diaValido(inicio) ? d : null,
      ),
      hora: horaValida(hora) ? hora : null,
    });
  }

  const primeira = locais.flatMap((l) => l.datas).filter((d): d is string => Boolean(d)).sort()[0] ?? null;
  const plano = await prisma.planoDeTreinamento.create({
    data: {
      companyId,
      serviceId,
      titulo: titulo.slice(0, 120),
      objetivo: objetivo.slice(0, 4000),
      periodicidade,
      horario: locais[0]?.hora ?? null,
      inicio: dayKeyToDate(primeira ?? dateToDayKey(new Date())),
      createdById: session.userId,
      encontros: {
        create: locais.flatMap((l) =>
          temas.map((tema, i) => ({
            branchId: l.branchId,
            ordem: i + 1,
            tema: tema.slice(0, 200),
            data: l.datas[i] ? dayKeyToDate(l.datas[i]!) : null,
            hora: l.datas[i] ? l.hora : null,
          })),
        ),
      },
    },
    select: { id: true },
  });

  await log(
    companyId,
    session.userId,
    "CRIOU",
    plano.id,
    `Criou o plano "${titulo}" com ${temas.length} tema(s) em ${locais.length} local(is).`,
  );

  refresh(companyId);
  return { ok: true, id: plano.id };
}

// ------------------------------------------------------------------ editar

export async function editarPlano(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const id = String(formData.get("id") ?? "");
  const serviceId = String(formData.get("serviceId") ?? "");
  const titulo = texto(formData.get("titulo"));
  const objetivo = texto(formData.get("objetivo"));
  const periodicidade = lerPeriodicidade(formData.get("periodicidade"));
  const horario = String(formData.get("horario") ?? "").trim();
  const status = String(formData.get("status") ?? "ATIVO");

  if (!serviceId) return { error: "Escolha o produto." };
  if (titulo.length < 2) return { error: "Dê um nome ao plano." };
  if (objetivo.length < 3) return { error: "Escreva o objetivo do plano." };
  if (horario && !horaValida(horario)) return { error: "Confira o horário." };
  if (!["ATIVO", "PAUSADO", "CONCLUIDO"].includes(status)) return { error: "Situação inválida." };

  const [existe, produto] = await Promise.all([
    prisma.planoDeTreinamento.count({ where: { id } }),
    prisma.service.count({ where: { id: serviceId } }),
  ]);
  if (!existe) return { error: "Plano não encontrado." };
  if (!produto) return { error: "Produto não encontrado." };

  const plano = await prisma.planoDeTreinamento.update({
    where: { id },
    data: {
      serviceId,
      titulo: titulo.slice(0, 120),
      objetivo: objetivo.slice(0, 4000),
      periodicidade,
      horario: horario || null,
      status,
    },
    select: {
      companyId: true,
      encontros: { select: { tema: true, visitId: true, meetingId: true } },
    },
  });

  // O nome e o produto do plano estão em cada compromisso da agenda.
  for (const e of plano.encontros) {
    if (e.meetingId) await acertarAgenda(e.meetingId, session.userId);
    else if (e.visitId) {
      await prisma.visit.updateMany({
        where: { id: e.visitId },
        data: { subject: assunto(titulo, e.tema), serviceId },
      });
    }
  }

  await log(plano.companyId, session.userId, "ATUALIZOU", id, `Editou o plano "${titulo}".`);
  refresh(plano.companyId);
  return { ok: true };
}

// --------------------------------------------------------------- encontros

/**
 * Acrescenta um encontro no fim do plano, numa filial. Sem dia, sugere a
 * próxima data da periodicidade depois do último encontro marcado nela.
 */
export async function adicionarEncontro(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const planoId = String(formData.get("planoId") ?? "");
  const tema = texto(formData.get("tema"));
  let dia = String(formData.get("dia") ?? "");
  let hora = String(formData.get("hora") ?? "").trim();

  if (tema.length < 2) return { error: "Escreva o tema do encontro." };

  const plano = await prisma.planoDeTreinamento.findUnique({
    where: { id: planoId },
    select: { companyId: true, titulo: true, periodicidade: true, horario: true, inicio: true },
  });
  if (!plano) return { error: "Plano não encontrado." };

  const branchId = await filialDaEmpresa(plano.companyId, String(formData.get("filial") ?? ""));
  if (branchId === undefined) return { error: "Filial inválida." };

  const doLocal = await prisma.encontroDoPlano.findMany({
    where: { planoId, branchId },
    orderBy: { ordem: "desc" },
    select: { ordem: true, data: true, hora: true },
  });

  if (!dia) {
    const ultima = doLocal.find((e) => e.data);
    dia =
      (ultima?.data
        ? proximaData(dateToDayKey(ultima.data), plano.periodicidade as Periodicidade, plano.inicio.getUTCDate())
        : null) ?? "";
    if (!hora) hora = ultima?.hora ?? plano.horario ?? "";
  }
  if (dia && !diaValido(dia)) return { error: "Confira o dia." };
  if (dia && !horaValida(hora)) return { error: "Diga o horário do encontro." };

  await prisma.encontroDoPlano.create({
    data: {
      planoId,
      branchId,
      ordem: (doLocal[0]?.ordem ?? 0) + 1,
      tema: tema.slice(0, 200),
      data: dia ? dayKeyToDate(dia) : null,
      hora: dia ? hora : null,
    },
  });

  await log(plano.companyId, session.userId, "CRIOU", planoId, `Acrescentou "${tema}" ao plano "${plano.titulo}".`);
  refresh(plano.companyId);
  return { ok: true };
}

/** Troca o tema de um encontro. Na agenda e na reunião, o nome acompanha. */
export async function mudarTema(encontroId: string, valor: string): Promise<PlanoState> {
  const session = await requireSession();
  const tema = textoSeguro(valor).trim();
  if (tema.length < 2) return { error: "Escreva o tema." };

  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };

  await prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { tema: tema.slice(0, 200) } });
  if (e.meetingId) {
    await prisma.meeting.update({ where: { id: e.meetingId }, data: { title: tema.slice(0, 200) } });
    await acertarAgenda(e.meetingId, session.userId);
  } else if (e.visitId) {
    await prisma.visit.update({ where: { id: e.visitId }, data: { subject: assunto(e.plano.titulo, tema) } });
  }

  refresh(e.plano.companyId);
  return { ok: true };
}

/** O dia e a hora de um encontro. Na agenda e na reunião, a data acompanha. */
export async function mudarDataDoEncontro(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const encontroId = String(formData.get("encontroId") ?? "");
  const aAgendar = formData.get("aAgendar") === "on";
  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "").trim();

  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };

  if (aAgendar) {
    if (e.visitId || (e.meeting && e.meeting.status !== "PLANEJADA")) {
      return { error: "Este encontro já está na agenda. Para tirar a data, tire-o da agenda primeiro." };
    }
    await prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { data: null, hora: null } });
    if (e.meetingId) await prisma.meeting.update({ where: { id: e.meetingId }, data: { date: null, startTime: null } });
  } else {
    if (!diaValido(dia)) return { error: "Escolha o dia." };
    if (!horaValida(hora)) return { error: "Diga a hora." };
    await prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { data: dayKeyToDate(dia), hora } });
    if (e.meetingId) {
      await prisma.meeting.update({ where: { id: e.meetingId }, data: { date: dayKeyToDate(dia), startTime: hora } });
      await acertarAgenda(e.meetingId, session.userId);
    } else if (e.visitId) {
      await prisma.visit.update({ where: { id: e.visitId }, data: { date: dayKeyToDate(dia), startTime: hora } });
    }
  }

  refresh(e.plano.companyId);
  return { ok: true };
}

/** Manda o encontro para a agenda: nasce o compromisso, com o nome do plano. */
export async function mandarParaAgenda(encontroId: string): Promise<PlanoState> {
  const session = await requireSession();

  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };
  if (e.visitId || (e.meeting && e.meeting.status !== "PLANEJADA")) return { ok: true };
  if (!e.data || !e.hora) return { error: "Marque o dia e a hora do encontro antes de mandar para a agenda." };

  const visita = await prisma.visit.create({
    data: {
      companyId: e.plano.companyId,
      date: e.data,
      startTime: e.hora,
      subject: assunto(e.plano.titulo, e.tema),
      location: e.branch?.name ?? null,
      serviceId: e.plano.serviceId,
      kind: "ACOMPANHAMENTO",
      status: "AGENDADA",
      createdById: session.userId,
    },
    select: { id: true },
  });
  await prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { visitId: visita.id } });
  // A preparação acompanha o compromisso: é ela que vira a reunião depois.
  if (e.meetingId) await prisma.meeting.update({ where: { id: e.meetingId }, data: { visitId: visita.id } });

  await log(
    e.plano.companyId,
    session.userId,
    "CRIOU",
    visita.id,
    `Mandou "${e.tema}" (plano "${e.plano.titulo}") para a agenda em ${formatFullDate(e.data)}.`,
  );
  refresh(e.plano.companyId);
  return { ok: true };
}

/** Manda para a agenda todos os encontros do plano que já têm dia e ainda não foram. */
export async function mandarTodosParaAgenda(planoId: string, branchId: string | null): Promise<PlanoState> {
  await requireSession();
  const pendentes = await prisma.encontroDoPlano.findMany({
    where: { planoId, branchId, visitId: null, meetingId: null, data: { not: null }, hora: { not: null } },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  for (const e of pendentes) {
    const r = await mandarParaAgenda(e.id);
    if (r.error) return r;
  }
  return { ok: true };
}

/**
 * Abre o encontro com as ferramentas de uma reunião (pauta, participantes,
 * ata, apresentação). Na primeira vez nasce a reunião em preparação, com o
 * tema, a data e a filial do encontro; depois, abre a mesma.
 */
export async function prepararEncontro(encontroId: string): Promise<PlanoState> {
  const session = await requireSession();
  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };
  if (e.meetingId) return { ok: true, id: e.meetingId };

  const ultima = await prisma.meeting.aggregate({ where: { companyId: e.plano.companyId }, _max: { number: true } });
  const numero = (ultima._max.number ?? 0) + 1;

  const realizado = e.visit?.status === "REALIZADA";
  const reuniao = await prisma.meeting.create({
    data: {
      companyId: e.plano.companyId,
      number: numero,
      title: e.tema,
      date: e.data,
      startTime: e.hora,
      location: e.branch?.name ?? null,
      // A pauta escrita no planejamento passa para a reunião.
      agenda: e.pauta,
      // Já realizado na agenda: a ata que se escrever agora é de uma reunião que aconteceu.
      status: realizado ? "REALIZADA" : "PLANEJADA",
      visitId: e.visitId,
      planoId: e.plano.id,
      ordemNoPlano: e.ordem,
      branchId: e.branchId,
      createdById: session.userId,
    },
    select: { id: true },
  });
  await prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { meetingId: reuniao.id } });

  await log(
    e.plano.companyId,
    session.userId,
    "CRIOU",
    reuniao.id,
    `Começou a preparar "${e.tema}" (plano "${e.plano.titulo}") como ${codigoDaReuniao(numero)}.`,
  );
  refresh(e.plano.companyId);
  return { ok: true, id: reuniao.id };
}

/** Tira o encontro da agenda (apaga o compromisso). Reunião já criada não sai por aqui. */
export async function tirarDaAgenda(encontroId: string): Promise<PlanoState> {
  await requireSession();
  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };
  if (e.meeting && e.meeting.status !== "PLANEJADA") {
    return { error: "Este encontro já virou reunião. Para desfazer, exclua a reunião na aba Reuniões." };
  }
  if (e.visitId) await prisma.visit.deleteMany({ where: { id: e.visitId } });
  // A preparação continua no plano, só sem o compromisso.
  if (e.meetingId) await prisma.meeting.update({ where: { id: e.meetingId }, data: { visitId: null } });
  refresh(e.plano.companyId);
  return { ok: true };
}

/** Marca (ou desmarca) o encontro como realizado: na reunião, se já é uma; senão, na agenda. */
export async function marcarRealizado(encontroId: string, realizado: boolean): Promise<PlanoState> {
  const session = await requireSession();
  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };
  if (e.meeting?.status === "PLANEJADA" && !e.visitId) {
    return { error: "Mande o encontro para a agenda antes de marcar como realizado." };
  }

  if (e.meetingId) {
    await prisma.meeting.update({ where: { id: e.meetingId }, data: { status: realizado ? "REALIZADA" : "AGENDADA" } });
    await acertarAgenda(e.meetingId, session.userId);
  } else if (e.visitId) {
    await prisma.visit.update({ where: { id: e.visitId }, data: { status: realizado ? "REALIZADA" : "AGENDADA" } });
  } else {
    return { error: "Mande o encontro para a agenda antes de marcar como realizado." };
  }

  refresh(e.plano.companyId);
  return { ok: true };
}

/** Sobe ou desce um encontro na ordem da sua filial. */
export async function moverEncontro(encontroId: string, direcao: "subir" | "descer"): Promise<PlanoState> {
  await requireSession();
  const e = await prisma.encontroDoPlano.findUnique({
    where: { id: encontroId },
    select: { planoId: true, branchId: true, ordem: true, plano: { select: { companyId: true } } },
  });
  if (!e) return { error: "Encontro não encontrado." };

  const vizinho = await prisma.encontroDoPlano.findFirst({
    where: {
      planoId: e.planoId,
      branchId: e.branchId,
      ordem: direcao === "subir" ? { lt: e.ordem } : { gt: e.ordem },
    },
    orderBy: { ordem: direcao === "subir" ? "desc" : "asc" },
    select: { id: true, ordem: true },
  });
  if (!vizinho) return { ok: true };

  await prisma.$transaction([
    prisma.encontroDoPlano.update({ where: { id: encontroId }, data: { ordem: vizinho.ordem } }),
    prisma.encontroDoPlano.update({ where: { id: vizinho.id }, data: { ordem: e.ordem } }),
  ]);
  refresh(e.plano.companyId);
  return { ok: true };
}

/**
 * O que acontece com a agenda e a reunião quando um encontro sai do plano.
 *
 * O que já foi realizado fica como histórico (agenda e reunião). O que ainda
 * não aconteceu sai da agenda; a reunião vazia é apagada, e a que já tem
 * pauta, ata ou participantes é arquivada — sai da agenda, mas o conteúdo fica.
 */
async function tirarDaAgendaAoExcluir(e: {
  visitId: string | null;
  meetingId: string | null;
  visit: { status: string } | null;
  meeting: { status: string } | null;
}) {
  const realizado = e.visit?.status === "REALIZADA" || e.meeting?.status === "REALIZADA";
  if (realizado) return;

  if (e.meetingId) {
    const r = await prisma.meeting.findUnique({
      where: { id: e.meetingId },
      select: { agenda: true, _count: { select: { items: true, participants: true, files: true } } },
    });
    const temConteudo = Boolean(r?.agenda?.trim()) || (r ? r._count.items + r._count.participants + r._count.files > 0 : false);
    if (temConteudo) {
      await prisma.meeting.update({ where: { id: e.meetingId }, data: { status: "ARQUIVADA", planoId: null, visitId: null } });
    } else {
      await prisma.meeting.deleteMany({ where: { id: e.meetingId } });
    }
  }
  if (e.visitId) await prisma.visit.deleteMany({ where: { id: e.visitId } });
}

/**
 * Tira o encontro do plano, e da agenda junto (veja `tirarDaAgendaAoExcluir`).
 */
export async function excluirEncontro(encontroId: string): Promise<PlanoState> {
  const session = await requireSession();
  const e = await carregarEncontro(encontroId);
  if (!e) return { error: "Encontro não encontrado." };

  await prisma.encontroDoPlano.delete({ where: { id: encontroId } });
  await tirarDaAgendaAoExcluir(e);

  await log(e.plano.companyId, session.userId, "EXCLUIU", encontroId, `Tirou "${e.tema}" do plano "${e.plano.titulo}".`);
  refresh(e.plano.companyId);
  return { ok: true };
}

/**
 * Remarca os encontros de uma filial que ainda não aconteceram: o primeiro
 * vai para `aPartirDe`, e os seguintes seguem a periodicidade. Na agenda e na
 * reunião, as datas acompanham.
 */
export async function remarcarPendentes(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const planoId = String(formData.get("planoId") ?? "");
  const aPartirDe = String(formData.get("aPartirDe") ?? "");
  const hora = String(formData.get("hora") ?? "").trim();

  if (!diaValido(aPartirDe)) return { error: "Escolha a data do próximo encontro." };
  if (!horaValida(hora)) return { error: "Diga o horário." };

  const plano = await prisma.planoDeTreinamento.findUnique({
    where: { id: planoId },
    select: { companyId: true, titulo: true, periodicidade: true },
  });
  if (!plano) return { error: "Plano não encontrado." };
  const branchId = await filialDaEmpresa(plano.companyId, String(formData.get("filial") ?? ""));
  if (branchId === undefined) return { error: "Filial inválida." };

  const encontros = await prisma.encontroDoPlano.findMany({
    where: { planoId, branchId },
    orderBy: { ordem: "asc" },
    include: { visit: { select: { status: true } }, meeting: { select: { status: true } } },
  });
  const pendentes = encontros.filter((e) => e.meeting?.status !== "REALIZADA" && e.visit?.status !== "REALIZADA");
  if (pendentes.length === 0) return { error: "Não há encontro pendente para remarcar." };

  const periodicidade = plano.periodicidade === "LIVRE" ? "SEMANAL" : (plano.periodicidade as Periodicidade);
  const datas = datasDoPlano(aPartirDe, periodicidade, pendentes.length);

  for (let i = 0; i < pendentes.length; i++) {
    const e = pendentes[i];
    const dia = dayKeyToDate(datas[i]!);
    await prisma.encontroDoPlano.update({ where: { id: e.id }, data: { data: dia, hora } });
    if (e.meetingId) {
      await prisma.meeting.update({ where: { id: e.meetingId }, data: { date: dia, startTime: hora } });
      await acertarAgenda(e.meetingId, session.userId);
    } else if (e.visitId) {
      await prisma.visit.update({ where: { id: e.visitId }, data: { date: dia, startTime: hora } });
    }
  }

  await log(
    plano.companyId,
    session.userId,
    "ATUALIZOU",
    planoId,
    `Remarcou ${pendentes.length} encontro(s) do plano "${plano.titulo}" a partir de ${formatFullDate(dayKeyToDate(aPartirDe))}.`,
  );
  refresh(plano.companyId);
  return { ok: true };
}

// ----------------------------------------------------------------- replicar

/**
 * Replica o plano de uma filial para outras. Cada filial nova ganha os mesmos
 * temas, na mesma ordem, com as suas datas (primeira data + periodicidade).
 * O que foi preparado vai junto: a pauta e as apresentações anexadas. Os
 * convocados e a ata não, porque são de cada filial.
 */
export async function replicarPlano(_prev: PlanoState, formData: FormData): Promise<PlanoState> {
  const session = await requireSession();

  const planoId = String(formData.get("planoId") ?? "");
  const destinos = formData.getAll("destino").map(String);
  if (destinos.length === 0) return { error: "Marque para quais filiais replicar." };

  const plano = await prisma.planoDeTreinamento.findUnique({
    where: { id: planoId },
    select: { companyId: true, titulo: true, periodicidade: true },
  });
  if (!plano) return { error: "Plano não encontrado." };

  const origem = await filialDaEmpresa(plano.companyId, String(formData.get("origem") ?? ""));
  if (origem === undefined) return { error: "Filial de origem inválida." };

  const modelo = await prisma.encontroDoPlano.findMany({
    where: { planoId, branchId: origem },
    orderBy: { ordem: "asc" },
    include: {
      meeting: {
        select: {
          agenda: true,
          files: { select: { name: true, mimeType: true, size: true, data: true } },
        },
      },
    },
  });
  if (modelo.length === 0) return { error: "A filial de origem não tem encontros para replicar." };

  const jaNoPlano = new Set(
    (await prisma.encontroDoPlano.findMany({ where: { planoId }, distinct: ["branchId"], select: { branchId: true } })).map(
      (e) => e.branchId ?? EMPRESA,
    ),
  );

  const periodicidade = plano.periodicidade as Periodicidade;
  let numero = (await prisma.meeting.aggregate({ where: { companyId: plano.companyId }, _max: { number: true } }))._max.number ?? 0;
  const nomes: string[] = [];

  for (const d of destinos) {
    const branchId = await filialDaEmpresa(plano.companyId, d);
    if (branchId === undefined) return { error: "Uma das filiais escolhidas não é desta empresa." };
    if (jaNoPlano.has(branchId ?? EMPRESA)) continue;

    const inicio = String(formData.get(`inicio-${d}`) ?? "");
    const hora = String(formData.get(`hora-${d}`) ?? "").trim();
    if (periodicidade !== "LIVRE") {
      if (!diaValido(inicio)) return { error: "Escolha a data do primeiro encontro em cada filial." };
      if (!horaValida(hora)) return { error: "Diga o horário em cada filial." };
    }
    const datas = periodicidade === "LIVRE" ? modelo.map(() => null) : datasDoPlano(inicio, periodicidade, modelo.length);
    const filial = branchId ? await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }) : null;

    for (let i = 0; i < modelo.length; i++) {
      const m = modelo[i];
      const dia = datas[i] ? dayKeyToDate(datas[i]!) : null;
      const pauta = m.meeting?.agenda ?? m.pauta ?? null;
      const preparado = Boolean(pauta?.trim()) || (m.meeting?.files.length ?? 0) > 0;

      const novo = await prisma.encontroDoPlano.create({
        data: { planoId, branchId, ordem: m.ordem, tema: m.tema, pauta, data: dia, hora: dia ? hora : null },
        select: { id: true },
      });

      // O que foi preparado na origem nasce preparado aqui também.
      if (preparado) {
        numero += 1;
        const reuniao = await prisma.meeting.create({
          data: {
            companyId: plano.companyId,
            number: numero,
            title: m.tema,
            date: dia,
            startTime: dia ? hora : null,
            location: filial?.name ?? null,
            status: "PLANEJADA",
            agenda: pauta,
            planoId,
            ordemNoPlano: m.ordem,
            branchId,
            createdById: session.userId,
            files: m.meeting?.files.length ? { create: m.meeting.files } : undefined,
          },
          select: { id: true },
        });
        await prisma.encontroDoPlano.update({ where: { id: novo.id }, data: { meetingId: reuniao.id } });
      }
    }
    jaNoPlano.add(branchId ?? EMPRESA);
    nomes.push(filial?.name ?? "Empresa toda");
  }

  if (nomes.length === 0) return { error: "Essas filiais já estão no plano." };

  await log(
    plano.companyId,
    session.userId,
    "CRIOU",
    planoId,
    `Replicou o plano "${plano.titulo}" para ${nomes.join(", ")}.`,
  );
  refresh(plano.companyId);
  return { ok: true };
}

// ----------------------------------------------------------------- excluir

/**
 * Exclui o plano, e da agenda o que ainda não aconteceu (a mesma regra de
 * tirar um encontro). O que já foi realizado fica como histórico.
 */
export async function excluirPlano(planoId: string): Promise<PlanoState> {
  const session = await requireSession();

  const plano = await prisma.planoDeTreinamento.findUnique({
    where: { id: planoId },
    select: {
      companyId: true,
      titulo: true,
      encontros: {
        select: { visitId: true, meetingId: true, visit: { select: { status: true } }, meeting: { select: { status: true } } },
      },
    },
  });
  if (!plano) return { error: "Plano não encontrado." };

  await prisma.planoDeTreinamento.delete({ where: { id: planoId } });
  for (const e of plano.encontros) await tirarDaAgendaAoExcluir(e);

  await log(plano.companyId, session.userId, "EXCLUIU", planoId, `Excluiu o plano "${plano.titulo}".`);
  refresh(plano.companyId);
  return { ok: true };
}
