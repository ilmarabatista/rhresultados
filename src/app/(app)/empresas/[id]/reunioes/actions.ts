"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { diaValido, horaValida } from "@/lib/agenda";
import { dayKeyToDate, formatFullDate } from "@/lib/dates";
import { textoSeguro } from "@/lib/texto-seguro";
import { codigoDaReuniao, TIPOS_DE_ITEM, type TipoDeItem } from "@/lib/reunioes";
import { acertarAgenda } from "@/lib/reuniao-agenda";

/**
 * As reuniões da empresa.
 *
 * A pauta é escrita antes e vai enchendo durante a semana; a ata é escrita
 * depois, em três partes — conversado, decidido e combinado. A apresentação
 * usada fica anexada à reunião.
 *
 * A reunião criada à mão e a de um plano de treinamento têm a mesma página. O
 * compromisso na agenda acompanha a reunião (`acertarAgenda`), e o encontro
 * do plano acompanha a data.
 */

export type ReuniaoState = { error?: string; ok?: boolean; id?: string };

/** Apresentação com imagens passa fácil dos 10 MB dos currículos. */
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

function refresh(companyId: string) {
  // A lista, a reunião, o planejamento e a ficha da empresa moram no mesmo layout.
  revalidatePath(`/empresas/${companyId}`, "layout");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
}

function textoOpcional(valor: FormDataEntryValue | string | null): string | null {
  return textoSeguro(String(valor ?? "")).trim() || null;
}

async function registrar(
  companyId: string,
  userId: string,
  action: "CRIOU" | "ATUALIZOU" | "EXCLUIU" | "CONCLUIU",
  entityId: string,
  description: string,
) {
  await prisma.activity.create({
    data: { companyId, userId, action, entityType: "REUNIAO", entityId, description },
  });
}

/** A unidade só vale se for desta empresa; vazio é a rede toda. */
async function unidadeDaEmpresa(companyId: string, branchId: string): Promise<string | null> {
  if (!branchId) return null;
  const achadas = await prisma.branch.count({ where: { id: branchId, companyId } });
  return achadas > 0 ? branchId : null;
}

/** Qualquer produto do catálogo vale; vazio é reunião sem produto. */
async function produtoDoCatalogo(serviceId: string): Promise<string | null> {
  if (!serviceId) return null;
  const achados = await prisma.service.count({ where: { id: serviceId } });
  return achados > 0 ? serviceId : null;
}

/** A reunião, com o que as ações precisam dela. */
async function carregar(reuniaoId: string) {
  return prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: { id: true, companyId: true, title: true, number: true, date: true, status: true },
  });
}

// ------------------------------------------------------------------ criar

export async function criarReuniao(_prev: ReuniaoState, formData: FormData): Promise<ReuniaoState> {
  const session = await requireSession();

  const companyId = String(formData.get("companyId") ?? "");
  const aAgendar = formData.get("aAgendar") === "on";
  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "").trim();
  const titulo = textoSeguro(String(formData.get("titulo") ?? "")).trim();

  if (titulo.length < 2) return { error: "Dê um título à reunião." };
  if (!aAgendar) {
    if (!diaValido(dia)) return { error: "Escolha o dia da reunião, ou marque “a agendar”." };
    if (!horaValida(hora)) return { error: "Diga a hora da reunião." };
  }

  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!empresa) return { error: "Empresa não encontrada." };

  const ultima = await prisma.meeting.aggregate({ where: { companyId }, _max: { number: true } });
  const numero = (ultima._max.number ?? 0) + 1;
  const data = aAgendar ? null : dayKeyToDate(dia);

  const reuniao = await prisma.meeting.create({
    data: {
      companyId,
      number: numero,
      title: titulo,
      date: data,
      startTime: aAgendar ? null : hora,
      status: "AGENDADA",
      serviceId: await produtoDoCatalogo(String(formData.get("produtoId") ?? "")),
      department: textoOpcional(formData.get("setor")),
      branchId: await unidadeDaEmpresa(companyId, String(formData.get("branchId") ?? "")),
      kind: textoOpcional(formData.get("tipo")),
      location: textoOpcional(formData.get("local")),
      agenda: textoOpcional(formData.get("pauta")),
      createdById: session.userId,
    },
    select: { id: true },
  });

  await acertarAgenda(reuniao.id, session.userId);

  await registrar(
    companyId,
    session.userId,
    "CRIOU",
    reuniao.id,
    `Criou a reunião ${codigoDaReuniao(numero)} "${titulo}"${
      data ? ` para ${formatFullDate(data)} às ${hora}` : ", a agendar"
    }.`,
  );

  refresh(companyId);
  return { ok: true, id: reuniao.id };
}

/**
 * Transforma um compromisso da agenda em reunião (pauta, participantes, ata).
 * Se o compromisso é de um plano de treinamento, a reunião nasce ligada ao
 * plano, com o tema e a filial do encontro. Se já virou reunião, devolve a
 * mesma — o botão pode ser apertado de novo sem duplicar nada.
 */
export async function mandarParaReuniao(visitId: string): Promise<ReuniaoState> {
  const session = await requireSession();

  const ja = await prisma.meeting.findFirst({ where: { visitId }, select: { id: true, status: true } });
  if (ja && ja.status !== "PLANEJADA") return { ok: true, id: ja.id };

  const v = await prisma.visit.findUnique({
    where: { id: visitId },
    select: {
      companyId: true,
      date: true,
      startTime: true,
      subject: true,
      location: true,
      status: true,
      serviceId: true,
      encontroDoPlano: {
        select: { id: true, tema: true, pauta: true, branchId: true, planoId: true, meeting: { select: { id: true, status: true } } },
      },
    },
  });
  if (!v) return { error: "Compromisso não encontrado." };

  const encontro = v.encontroDoPlano;

  // O encontro já preparado no plano (pauta, participantes, apresentação) vira
  // a reunião: passa a aparecer na aba Reuniões, com o que já foi escrito.
  const preparada = ja ?? (encontro?.meeting?.status === "PLANEJADA" ? encontro.meeting : null);
  if (preparada) {
    await prisma.meeting.update({
      where: { id: preparada.id },
      data: {
        status: v.status === "REALIZADA" ? "REALIZADA" : "AGENDADA",
        visitId,
        date: v.date,
        startTime: v.startTime,
      },
    });
    await acertarAgenda(preparada.id, session.userId);
    refresh(v.companyId);
    return { ok: true, id: preparada.id };
  }
  const titulo = (encontro?.tema ?? v.subject ?? "Reunião").slice(0, 200);

  const ultima = await prisma.meeting.aggregate({ where: { companyId: v.companyId }, _max: { number: true } });
  const numero = (ultima._max.number ?? 0) + 1;

  const reuniao = await prisma.meeting.create({
    data: {
      companyId: v.companyId,
      number: numero,
      title: titulo,
      date: v.date,
      startTime: v.startTime,
      location: v.location,
      agenda: encontro?.pauta ?? null,
      status: v.status === "REALIZADA" ? "REALIZADA" : "AGENDADA",
      visitId,
      planoId: encontro?.planoId ?? null,
      branchId: encontro?.branchId ?? null,
      // O produto do compromisso; na reunião de plano, vazio é o produto do plano.
      serviceId: encontro ? null : v.serviceId,
      createdById: session.userId,
    },
    select: { id: true },
  });
  if (encontro) {
    await prisma.encontroDoPlano.update({ where: { id: encontro.id }, data: { meetingId: reuniao.id } });
  }
  await acertarAgenda(reuniao.id, session.userId);

  await registrar(
    v.companyId,
    session.userId,
    "CRIOU",
    reuniao.id,
    `Mandou o compromisso de ${formatFullDate(v.date)} para reunião: ${codigoDaReuniao(numero)} "${titulo}".`,
  );

  refresh(v.companyId);
  return { ok: true, id: reuniao.id };
}

// -------------------------------------------------------------- mudar

export type CampoDaReuniao = "titulo" | "produto" | "setor" | "tipo" | "local" | "pauta" | "unidade";

/** Muda um campo da reunião, direto na tela: cada um é gravado ao sair dele. */
export async function mudarCampoDaReuniao(
  reuniaoId: string,
  campo: CampoDaReuniao,
  valor: string,
): Promise<ReuniaoState> {
  const session = await requireSession();

  const r = await carregar(reuniaoId);
  if (!r) return { error: "Reunião não encontrada." };

  let data: Prisma.MeetingUncheckedUpdateInput;
  switch (campo) {
    case "titulo": {
      const titulo = textoSeguro(valor).trim();
      if (titulo.length < 2) return { error: "Dê um título à reunião." };

      data = { title: titulo };
      // Na reunião de um plano, o tema do encontro acompanha o título.
      await prisma.encontroDoPlano.updateMany({
        where: { meetingId: reuniaoId },
        data: { tema: titulo.slice(0, 200) },
      });
      break;
    }
    case "produto":
      data = { serviceId: await produtoDoCatalogo(valor) };
      break;
    case "setor":
      data = { department: textoOpcional(valor) };
      break;
    case "tipo":
      data = { kind: textoOpcional(valor) };
      break;
    case "local":
      data = { location: textoOpcional(valor) };
      break;
    case "pauta":
      data = { agenda: textoSeguro(valor).trimEnd() || null };
      break;
    case "unidade":
      data = { branchId: await unidadeDaEmpresa(r.companyId, valor) };
      break;
    default:
      return { error: "Campo inválido." };
  }

  await prisma.meeting.update({ where: { id: reuniaoId }, data });
  if (campo === "titulo" || campo === "local" || campo === "produto") {
    await acertarAgenda(reuniaoId, session.userId);
  }

  refresh(r.companyId);
  return { ok: true };
}

/** O dia e a hora — ou "a agendar", que tira a reunião da agenda. */
export async function mudarDataDaReuniao(_prev: ReuniaoState, formData: FormData): Promise<ReuniaoState> {
  const session = await requireSession();

  const reuniaoId = String(formData.get("reuniaoId") ?? "");
  const aAgendar = formData.get("aAgendar") === "on";
  const dia = String(formData.get("dia") ?? "");
  const hora = String(formData.get("hora") ?? "").trim();

  const r = await carregar(reuniaoId);
  if (!r) return { error: "Reunião não encontrada." };

  if (!aAgendar) {
    if (!diaValido(dia)) return { error: "Escolha o dia." };
    if (!horaValida(hora)) return { error: "Diga a hora." };
  }

  await prisma.meeting.update({
    where: { id: reuniaoId },
    data: aAgendar ? { date: null, startTime: null } : { date: dayKeyToDate(dia), startTime: hora },
  });
  // Na reunião de um plano, o encontro do plano acompanha a data.
  if (!aAgendar) {
    await prisma.encontroDoPlano.updateMany({
      where: { meetingId: reuniaoId },
      data: { data: dayKeyToDate(dia), hora },
    });
  }
  await acertarAgenda(reuniaoId, session.userId);

  await registrar(
    r.companyId,
    session.userId,
    "ATUALIZOU",
    reuniaoId,
    aAgendar
      ? `Deixou a reunião ${codigoDaReuniao(r.number)} "${r.title}" a agendar.`
      : `Marcou a reunião ${codigoDaReuniao(r.number)} "${r.title}" para ${formatFullDate(dayKeyToDate(dia))} às ${hora}.`,
  );

  refresh(r.companyId);
  return { ok: true };
}

/** Encerra (ou reabre) a reunião: o compromisso da agenda acompanha. */
export async function encerrarReuniao(reuniaoId: string, encerrar = true): Promise<ReuniaoState> {
  const session = await requireSession();

  const r = await carregar(reuniaoId);
  if (!r) return { error: "Reunião não encontrada." };

  if (encerrar && !r.date) return { error: "Marque o dia da reunião antes de encerrar." };
  await prisma.meeting.update({
    where: { id: reuniaoId },
    data: { status: encerrar ? "REALIZADA" : "AGENDADA" },
  });
  await acertarAgenda(reuniaoId, session.userId);

  await registrar(
    r.companyId,
    session.userId,
    encerrar ? "CONCLUIU" : "ATUALIZOU",
    reuniaoId,
    `${encerrar ? "Encerrou" : "Reabriu"} a reunião ${codigoDaReuniao(r.number)} "${r.title}".`,
  );

  refresh(r.companyId);
  return { ok: true };
}

/** Arquiva (ou desarquiva) a reunião criada à mão. Arquivada, ela sai da agenda. */
export async function arquivarReuniao(reuniaoId: string, arquivar = true): Promise<ReuniaoState> {
  const session = await requireSession();

  const r = await carregar(reuniaoId);
  if (!r) return { error: "Reunião não encontrada." };

  await prisma.meeting.update({
    where: { id: reuniaoId },
    data: { status: arquivar ? "ARQUIVADA" : "AGENDADA" },
  });
  await acertarAgenda(reuniaoId, session.userId);

  refresh(r.companyId);
  return { ok: true };
}

/**
 * Exclui a reunião, com a pauta e a ata, e o compromisso dela na agenda. A de
 * um plano de treinamento continua no plano como encontro (sem reunião e sem
 * agenda), para poder ser remarcada ou tirada de lá.
 */
export async function excluirReuniao(reuniaoId: string): Promise<ReuniaoState> {
  const session = await requireSession();

  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: {
      companyId: true,
      title: true,
      number: true,
      visitId: true,
      encontroDoPlano: { select: { id: true } },
    },
  });
  if (!r) return { error: "Reunião não encontrada." };

  await prisma.$transaction([
    ...(r.visitId ? [prisma.visit.deleteMany({ where: { id: r.visitId } })] : []),
    prisma.meeting.delete({ where: { id: reuniaoId } }),
  ]);

  await registrar(
    r.companyId,
    session.userId,
    "EXCLUIU",
    reuniaoId,
    `Excluiu a reunião ${codigoDaReuniao(r.number)} "${r.title}", com a pauta e a ata${r.encontroDoPlano ? " (o encontro continua no plano)" : ""}.`,
  );

  refresh(r.companyId);
  return { ok: true };
}

// ------------------------------------------------------ apresentação usada

/** Anexa à reunião a apresentação usada nela, como veio. */
export async function enviarApresentacao(formData: FormData): Promise<ReuniaoState> {
  const session = await requireSession();

  const reuniaoId = String(formData.get("reuniaoId") ?? "");
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File) || arquivo.size === 0) return { error: "Escolha o arquivo." };
  if (arquivo.size > TAMANHO_MAXIMO) {
    return { error: "O arquivo passa de 25 MB. Diminua as imagens ou envie em PDF." };
  }

  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: { companyId: true, number: true },
  });
  if (!r) return { error: "Reunião não encontrada." };

  const nome = textoSeguro(arquivo.name);
  await prisma.meetingFile.create({
    data: {
      meetingId: reuniaoId,
      name: nome,
      mimeType: arquivo.type || "application/octet-stream",
      size: arquivo.size,
      data: new Uint8Array(await arquivo.arrayBuffer()),
    },
  });

  await registrar(
    r.companyId,
    session.userId,
    "ATUALIZOU",
    reuniaoId,
    `Anexou a apresentação "${nome}" à reunião ${codigoDaReuniao(r.number)}.`,
  );

  refresh(r.companyId);
  return { ok: true };
}

export async function removerApresentacao(arquivoId: string): Promise<ReuniaoState> {
  await requireSession();

  const arquivo = await prisma.meetingFile.findUnique({
    where: { id: arquivoId },
    select: { meeting: { select: { companyId: true } } },
  });
  if (!arquivo) return { error: "Arquivo não encontrado." };

  await prisma.meetingFile.delete({ where: { id: arquivoId } });

  refresh(arquivo.meeting.companyId);
  return { ok: true };
}

// --------------------------------------------------------- participantes

/** Convoca alguém: da equipe da empresa, ou só pelo nome. */
export async function adicionarParticipante(
  reuniaoId: string,
  employeeId: string | null,
  nome: string,
): Promise<ReuniaoState> {
  await requireSession();

  const r = await prisma.meeting.findUnique({ where: { id: reuniaoId }, select: { companyId: true } });
  if (!r) return { error: "Reunião não encontrada." };

  let nomeFinal = textoSeguro(nome).trim();
  let pessoaId: string | null = null;
  if (employeeId) {
    const pessoa = await prisma.employee.findFirst({
      where: { id: employeeId, companyId: r.companyId },
      select: { id: true, name: true },
    });
    if (pessoa) {
      pessoaId = pessoa.id;
      nomeFinal = pessoa.name;
    }
  }
  if (nomeFinal.length < 2) return { error: "Escreva o nome de quem participa." };

  const jaEsta = await prisma.meetingParticipant.findFirst({
    where: { meetingId: reuniaoId, name: { equals: nomeFinal, mode: "insensitive" } },
    select: { id: true },
  });
  if (!jaEsta) {
    await prisma.meetingParticipant.create({
      data: { meetingId: reuniaoId, employeeId: pessoaId, name: nomeFinal },
    });
  }

  refresh(r.companyId);
  return { ok: true };
}

/**
 * Convoca de uma vez a equipe ativa da empresa, ou só um setor. Quem já está
 * na lista não entra de novo.
 */
export async function convocarGrupo(reuniaoId: string, setor: string | null): Promise<ReuniaoState & { convocados?: number }> {
  await requireSession();

  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: { companyId: true, participants: { select: { employeeId: true, name: true } } },
  });
  if (!r) return { error: "Reunião não encontrada." };

  const pessoas = await prisma.employee.findMany({
    where: { companyId: r.companyId, status: "ATIVO", ...(setor ? { department: setor } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const jaEstao = new Set(r.participants.map((p) => p.employeeId ?? p.name.toLowerCase()));
  const novas = pessoas.filter((p) => !jaEstao.has(p.id) && !jaEstao.has(p.name.toLowerCase()));
  if (pessoas.length === 0) return { error: setor ? `Ninguém ativo no setor ${setor}.` : "Ninguém ativo na equipe desta empresa." };

  if (novas.length > 0) {
    await prisma.meetingParticipant.createMany({
      data: novas.map((p) => ({ meetingId: reuniaoId, employeeId: p.id, name: p.name })),
    });
  }

  refresh(r.companyId);
  return { ok: true, convocados: novas.length };
}

/** Marca (ou desmarca) que o convocado esteve presente. */
export async function marcarPresenca(participanteId: string, presente: boolean): Promise<ReuniaoState> {
  await requireSession();
  const p = await prisma.meetingParticipant.findUnique({
    where: { id: participanteId },
    select: { meeting: { select: { companyId: true } } },
  });
  if (!p) return { error: "Participante não encontrado." };
  await prisma.meetingParticipant.update({ where: { id: participanteId }, data: { present: presente } });
  refresh(p.meeting.companyId);
  return { ok: true };
}

/** Marca todos os convocados como presentes (ou tira a presença de todos). */
export async function marcarTodosPresentes(reuniaoId: string, presente = true): Promise<ReuniaoState> {
  await requireSession();
  const r = await prisma.meeting.findUnique({ where: { id: reuniaoId }, select: { companyId: true } });
  if (!r) return { error: "Reunião não encontrada." };
  await prisma.meetingParticipant.updateMany({ where: { meetingId: reuniaoId }, data: { present: presente } });
  refresh(r.companyId);
  return { ok: true };
}

export async function removerParticipante(participanteId: string): Promise<ReuniaoState> {
  await requireSession();

  const p = await prisma.meetingParticipant.findUnique({
    where: { id: participanteId },
    select: { meeting: { select: { companyId: true } } },
  });
  if (!p) return { error: "Participante não encontrado." };

  await prisma.meetingParticipant.delete({ where: { id: participanteId } });

  refresh(p.meeting.companyId);
  return { ok: true };
}

// ----------------------------------------------------------------- a ata

/**
 * Registra ou corrige um item da ata. O conversado é só o texto; o decidido
 * leva desde quando vale e por quê; o combinado, o responsável e a data.
 */
export async function salvarItem(_prev: ReuniaoState, formData: FormData): Promise<ReuniaoState> {
  const session = await requireSession();

  const reuniaoId = String(formData.get("reuniaoId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoDeItem;
  if (!TIPOS_DE_ITEM.includes(tipo)) return { error: "Tipo de registro inválido." };

  const texto = textoSeguro(String(formData.get("texto") ?? "")).trim();
  if (!texto) {
    return {
      error: `Escreva o que foi ${tipo === "CONVERSADO" ? "conversado" : tipo === "DECIDIDO" ? "decidido" : "combinado"}.`,
    };
  }

  const valeDesde = String(formData.get("valeDesde") ?? "");
  const prazo = String(formData.get("prazo") ?? "");
  if (valeDesde && !diaValido(valeDesde)) return { error: "Confira desde quando vale." };
  if (prazo && !diaValido(prazo)) return { error: "Confira a data do combinado." };

  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: { companyId: true, title: true, number: true },
  });
  if (!r) return { error: "Reunião não encontrada." };

  const campos = {
    text: texto,
    reason: tipo === "DECIDIDO" ? textoOpcional(formData.get("porque")) : null,
    validFrom: tipo === "DECIDIDO" && valeDesde ? dayKeyToDate(valeDesde) : null,
    responsible: tipo === "COMBINADO" ? textoOpcional(formData.get("responsavel")) : null,
    dueDate: tipo === "COMBINADO" && prazo ? dayKeyToDate(prazo) : null,
  };

  if (itemId) {
    const { count } = await prisma.meetingItem.updateMany({
      where: { id: itemId, meetingId: reuniaoId },
      data: campos,
    });
    if (count === 0) return { error: "Registro não encontrado." };
  } else {
    const ultimo = await prisma.meetingItem.aggregate({
      where: { meetingId: reuniaoId, kind: tipo },
      _max: { order: true },
    });
    await prisma.meetingItem.create({
      data: { ...campos, meetingId: reuniaoId, kind: tipo, order: (ultimo._max.order ?? -1) + 1 },
    });

    if (tipo === "COMBINADO") {
      await registrar(
        r.companyId,
        session.userId,
        "CRIOU",
        reuniaoId,
        `Combinado na reunião ${codigoDaReuniao(r.number)}: "${texto}"${
          campos.responsible ? `, com ${campos.responsible}` : ""
        }${campos.dueDate ? `, até ${formatFullDate(campos.dueDate)}` : ", sem data"}.`,
      );
    }
  }

  refresh(r.companyId);
  return { ok: true };
}

export async function marcarCombinado(itemId: string, feito = true): Promise<ReuniaoState> {
  const session = await requireSession();

  const item = await prisma.meetingItem.findUnique({
    where: { id: itemId },
    select: { text: true, kind: true, meeting: { select: { id: true, companyId: true, number: true } } },
  });
  if (!item || item.kind !== "COMBINADO") return { error: "Combinado não encontrado." };

  await prisma.meetingItem.update({
    where: { id: itemId },
    data: { done: feito, doneAt: feito ? new Date() : null },
  });

  if (feito) {
    await registrar(
      item.meeting.companyId,
      session.userId,
      "CONCLUIU",
      item.meeting.id,
      `Cumpriu o combinado da reunião ${codigoDaReuniao(item.meeting.number)}: "${item.text}".`,
    );
  }

  refresh(item.meeting.companyId);
  return { ok: true };
}

export async function excluirItem(itemId: string): Promise<ReuniaoState> {
  await requireSession();

  const item = await prisma.meetingItem.findUnique({
    where: { id: itemId },
    select: { meeting: { select: { companyId: true } } },
  });
  if (!item) return { error: "Registro não encontrado." };

  await prisma.meetingItem.delete({ where: { id: itemId } });

  refresh(item.meeting.companyId);
  return { ok: true };
}
