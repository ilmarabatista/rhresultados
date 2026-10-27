"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { lerFoto } from "@/lib/batidas";
import { mesLiberado } from "@/lib/calculo";
import { todayKey } from "@/lib/dates";
import { aprovarMes, mesesDoColaborador } from "@/lib/relatorio";

export type ResultadoAprovacao = { ok: true } | { ok: false; erro: string };

/** O colaborador confere o espelho do mês e aprova, com uma foto sua como comprovante. */
export async function aprovarEspelho(mes: string, fotoDataUrl: string): Promise<ResultadoAprovacao> {
  const s = await exigirColaborador();
  if (!/^\d{4}-\d{2}$/.test(mes) || !(await mesesDoColaborador(s.id)).includes(mes)) return { ok: false, erro: "Mês inválido." };

  const existente = await prisma.relatorio.findUnique({
    where: { colaboradorId_mes: { colaboradorId: s.id, mes } },
    select: { cienteEm: true },
  });
  if (existente?.cienteEm) return { ok: false, erro: "Você já aprovou este mês." };
  if (!existente && !mesLiberado(mes, todayKey())) return { ok: false, erro: "Este mês só fica disponível para aprovar no último dia dele." };

  const foto = lerFoto(String(fotoDataUrl ?? ""));
  if (!foto) return { ok: false, erro: "A foto não chegou direito. Tire outra e tente de novo." };

  const r = await aprovarMes(s.id, mes, foto);
  if (!r) return { ok: false, erro: "Não foi possível aprovar agora. Tente de novo." };
  revalidatePath("/");
  revalidatePath("/meu-ponto");
  return { ok: true };
}
