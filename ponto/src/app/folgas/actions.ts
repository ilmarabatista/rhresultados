"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { dayKeyToDate } from "@/lib/dates";
import { JANELA_DA_FOLGA, limitesDaFolga, MARCADA_PELO_COLABORADOR } from "@/lib/folgas";
import { NOME_DA_OCORRENCIA, type TipoOcorrencia } from "@/lib/calculo";

export type EstadoFolga = { erro?: string; ok?: string };

/**
 * O colaborador informa que estava (ou vai estar) de folga num dia. Vale na
 * hora: o dia sai do previsto e não conta como falta. O RH vê quem marcou e
 * pode excluir.
 */
export async function marcarFolga(_: EstadoFolga, formData: FormData): Promise<EstadoFolga> {
  const s = await exigirColaborador();
  const dia = String(formData.get("dia") ?? "");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 200);

  const { de, ate } = limitesDaFolga();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return { erro: "Escolha o dia da folga." };
  if (dia < de || dia > ate) return { erro: `Dá para marcar folga dos últimos ${JANELA_DA_FOLGA} dias até os próximos ${JANELA_DA_FOLGA}.` };

  const data = dayKeyToDate(dia);
  const ja = await prisma.ocorrencia.findFirst({ where: { colaboradorId: s.id, dia: data }, select: { tipo: true } });
  if (ja) return { erro: `Esse dia já está como ${NOME_DA_OCORRENCIA[ja.tipo as TipoOcorrencia].toLowerCase()}.` };

  await prisma.ocorrencia.create({
    data: {
      empresaId: s.empresa.id,
      colaboradorId: s.id,
      dia: data,
      tipo: "FOLGA",
      descricao: motivo || null,
      criadoPor: MARCADA_PELO_COLABORADOR,
    },
  });
  revalidatePath("/folgas");
  return { ok: `Folga de ${dia.split("-").reverse().join("/")} marcada.` };
}

/** Desfaz uma folga que o próprio colaborador marcou. As lançadas pelo RH ficam. */
export async function desmarcarFolga(id: string) {
  const s = await exigirColaborador();
  await prisma.ocorrencia.deleteMany({ where: { id, colaboradorId: s.id, criadoPor: MARCADA_PELO_COLABORADOR } });
  revalidatePath("/folgas");
}
