import "server-only";
import { prisma } from "./prisma";

/**
 * Deixa o compromisso da agenda igual à reunião (criada à mão ou de um plano
 * de treinamento).
 *
 * Com data, ele existe e acompanha o dia, a hora, o local, o produto e a
 * situação. Sem data, ou arquivada, a reunião sai da agenda. Se o compromisso
 * foi apagado direto na agenda, a reunião ganha outro.
 */
export async function acertarAgenda(reuniaoId: string, userId: string) {
  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: {
      companyId: true,
      title: true,
      date: true,
      startTime: true,
      location: true,
      status: true,
      visitId: true,
      serviceId: true,
      plano: { select: { titulo: true, serviceId: true } },
    },
  });
  if (!r) return;

  if (!r.date || r.status === "ARQUIVADA") {
    if (r.visitId) {
      await prisma.visit.deleteMany({ where: { id: r.visitId } });
      await prisma.meeting.update({ where: { id: reuniaoId }, data: { visitId: null } });
    }
    return;
  }

  // A reunião de um plano leva o nome do plano: é o que se lê na agenda.
  const assunto = r.plano ? `${r.plano.titulo}: ${r.title}` : `Reunião: ${r.title}`;
  const produto = r.serviceId ?? r.plano?.serviceId ?? null;

  // Em preparação, a reunião não põe nada na agenda: só acompanha o
  // compromisso que o plano já mandou para lá, se houver.
  if (r.status === "PLANEJADA") {
    if (!r.visitId) return;
    const { count } = await prisma.visit.updateMany({
      where: { id: r.visitId },
      data: {
        date: r.date,
        startTime: r.startTime ?? "08:00",
        location: r.location,
        subject: assunto,
        serviceId: produto,
      },
    });
    if (count === 0) await prisma.meeting.update({ where: { id: reuniaoId }, data: { visitId: null } });
    return;
  }

  const dados = {
    date: r.date,
    startTime: r.startTime ?? "08:00",
    location: r.location,
    subject: assunto,
    status: r.status === "REALIZADA" ? ("REALIZADA" as const) : ("AGENDADA" as const),
    serviceId: produto,
  };

  if (r.visitId) {
    const { count } = await prisma.visit.updateMany({ where: { id: r.visitId }, data: dados });
    if (count > 0) return;
  }

  const visita = await prisma.visit.create({
    data: { ...dados, companyId: r.companyId, kind: "ACOMPANHAMENTO", createdById: userId },
    select: { id: true },
  });
  await prisma.meeting.update({ where: { id: reuniaoId }, data: { visitId: visita.id } });
}
