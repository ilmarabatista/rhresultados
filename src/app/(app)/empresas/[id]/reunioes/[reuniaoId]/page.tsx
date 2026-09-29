import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, todayKey } from "@/lib/dates";
import {
  codigoDaReuniao,
  lerSituacao,
  TIPOS_DE_ITEM,
  type SituacaoDaReuniao,
  type TipoDeItem,
} from "@/lib/reunioes";
import { opcoesDaReuniao } from "@/lib/reunioes-dados";
import MeetingRecord from "@/components/meeting-record";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reunião — RH Resultados" };

/**
 * Uma reunião: quando, de que produto, quem, a pauta escrita antes, a ata
 * escrita depois e a apresentação usada.
 *
 * Serve à criada à mão e à de um plano de treinamento (que mostra o plano e o
 * produto no alto).
 */
export default async function ReuniaoPage({
  params,
}: {
  params: Promise<{ id: string; reuniaoId: string }>;
}) {
  await requireSession();
  const { id, reuniaoId } = await params;

  const [r, opcoes] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: reuniaoId },
      include: {
        items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        participants: { orderBy: { name: "asc" } },
        files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, size: true } },
        plano: { select: { titulo: true, serviceId: true, service: { select: { name: true } } } },
      },
    }),
    opcoesDaReuniao(id),
  ]);
  if (!r || r.companyId !== id) notFound();

  const situacao: SituacaoDaReuniao = lerSituacao(r.status);

  // Sem produto escolhido, a reunião de plano mostra o produto do plano.
  const produtoId = r.serviceId ?? r.plano?.serviceId ?? null;

  return (
    <MeetingRecord
      companyId={id}
      hoje={todayKey()}
      opcoes={opcoes}
      reuniao={{
        id: r.id,
        codigo: codigoDaReuniao(r.number),
        titulo: r.title,
        dia: r.date ? dateToDayKey(r.date) : null,
        hora: r.startTime,
        situacao,
        produtoId: produtoId && opcoes.produtos.some((p) => p.id === produtoId) ? produtoId : null,
        setor: r.department,
        unidadeId:
          r.branchId && opcoes.unidades.some((u) => u.id === r.branchId) ? r.branchId : null,
        tipo: r.kind,
        local: r.location,
        pauta: r.agenda ?? "",
        plano: r.plano
            ? {
                nome: r.plano.titulo,
                produto: r.plano.service?.name ?? null,
                entregaHref: `/empresas/${id}/planejamento`,
                naAgenda: Boolean(r.visitId),
              }
            : null,
        apresentacoes: r.files.map((f) => ({ id: f.id, nome: f.name, tamanho: f.size })),
        participantes: r.participants.map((p) => ({ id: p.id, nome: p.name, presente: p.present })),
        itens: r.items
          .filter((i) => (TIPOS_DE_ITEM as readonly string[]).includes(i.kind))
          .map((i) => ({
            id: i.id,
            tipo: i.kind as TipoDeItem,
            texto: i.text,
            porque: i.reason,
            valeDesde: i.validFrom ? dateToDayKey(i.validFrom) : null,
            responsavel: i.responsible,
            prazo: i.dueDate ? dateToDayKey(i.dueDate) : null,
            feito: i.done,
          })),
      }}
    />
  );
}
