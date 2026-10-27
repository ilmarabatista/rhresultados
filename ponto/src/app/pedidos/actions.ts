"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { dayKeyToDate } from "@/lib/dates";
import { lerHora, minutoNoDia, relogio, instanteNoDia } from "@/lib/calculo";
import { lerAnexo } from "@/lib/anexo";
import { diasEntre, limitesDoPedido, MAXIMO_DE_DIAS_DO_ATESTADO } from "@/lib/pedidos";

export type EstadoPedido = { erro?: string; ok?: string; enviado?: number };

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const data = (d: string) => d.split("-").reverse().join("/");

/**
 * O colaborador pede: justificar falta com atestado, ou corrigir uma batida.
 * O pedido fica esperando o RH; o ponto só muda quando ele aprovar.
 */
export async function fazerPedido(_: EstadoPedido, formData: FormData): Promise<EstadoPedido> {
  const s = await exigirColaborador();
  const tipo = formData.get("tipo");
  const motivo = String(formData.get("motivo") ?? "").trim().slice(0, 300);
  const { hoje, de, ateAtestado } = limitesDoPedido();
  const enviado = Date.now();

  if (tipo === "ATESTADO") {
    const inicio = String(formData.get("de") ?? "");
    const fim = String(formData.get("ate") ?? "") || inicio;
    if (!DIA.test(inicio) || !DIA.test(fim)) return { erro: "Escolha o dia da falta." };
    if (fim < inicio) return { erro: "O último dia vem depois do primeiro." };
    if (inicio < de || fim > ateAtestado) return { erro: `Dá para mandar atestado dos últimos 60 dias até ${data(ateAtestado)}.` };
    if (diasEntre(inicio, fim).length > MAXIMO_DE_DIAS_DO_ATESTADO) return { erro: "Período longo demais. Fale com o RH." };

    const anexo = await lerAnexo(formData.get("arquivo"));
    if (typeof anexo === "string") return { erro: anexo };
    if (!anexo) return { erro: "Anexe a foto ou o PDF do atestado." };

    await prisma.pedido.create({
      data: {
        empresaId: s.empresa.id,
        colaboradorId: s.id,
        tipo: "ATESTADO",
        dia: dayKeyToDate(inicio),
        ate: dayKeyToDate(fim),
        motivo: motivo || null,
        anexo: { create: { nome: anexo.nome, tipo: anexo.tipo, dados: new Uint8Array(anexo.dados) } },
      },
    });
    revalidatePath("/pedidos");
    return { ok: "Atestado enviado. O RH vai conferir e aprovar.", enviado };
  }

  if (tipo !== "CORRECAO") return { erro: "Escolha o que você quer pedir." };

  const dia = String(formData.get("dia") ?? "");
  if (!DIA.test(dia)) return { erro: "Escolha o dia." };
  if (dia < de || dia > hoje) return { erro: "Dá para pedir correção dos últimos 60 dias." };
  if (motivo.length < 3) return { erro: "Conte o que aconteceu, para o RH entender." };

  const marcacaoId = String(formData.get("marcacaoId") ?? "") || null;
  const tirar = formData.get("acao") === "tirar";
  let era: string | null = null;
  if (marcacaoId) {
    const m = await prisma.marcacao.findFirst({
      where: { id: marcacaoId, colaboradorId: s.id, dia: dayKeyToDate(dia), anuladaEm: null },
      select: { momento: true },
    });
    if (!m) return { erro: "Essa batida não está mais no seu ponto. Atualize a página." };
    era = relogio(minutoNoDia(m.momento, dia));
    const repetido = await prisma.pedido.count({ where: { marcacaoId, situacao: "PENDENTE" } });
    if (repetido) return { erro: `Já existe um pedido esperando o RH para a batida das ${era}.` };
  } else if (tirar) {
    return { erro: "Escolha a batida que está a mais." };
  }

  let minutos: number | null = null;
  if (!tirar) {
    const hora = lerHora(String(formData.get("hora") ?? ""));
    if (hora === null) return { erro: "Informe o horário certo, como 08:00." };
    minutos = hora + (formData.get("diaSeguinte") === "on" ? 1440 : 0);
    if (instanteNoDia(dia, minutos).getTime() > Date.now()) return { erro: "Esse horário ainda não chegou." };
    if (era === relogio(minutos) && minutos < 1440) return { erro: "O horário certo é igual ao que já está no ponto." };
  }

  await prisma.pedido.create({
    data: { empresaId: s.empresa.id, colaboradorId: s.id, tipo: "CORRECAO", dia: dayKeyToDate(dia), marcacaoId, minutos, era, motivo },
  });
  revalidatePath("/pedidos");
  return { ok: `Pedido de correção de ${data(dia)} enviado. O RH vai conferir e aprovar.`, enviado };
}

/** Desiste de um pedido que ainda não foi decidido. */
export async function cancelarPedido(id: string) {
  const s = await exigirColaborador();
  await prisma.pedido.deleteMany({ where: { id, colaboradorId: s.id, situacao: "PENDENTE" } });
  revalidatePath("/pedidos");
}

/** As batidas válidas de um dia do próprio colaborador, para escolher qual corrigir. */
export async function batidasDoDia(dia: string) {
  const s = await exigirColaborador();
  if (!DIA.test(dia)) return [];
  const lista = await prisma.marcacao.findMany({
    where: { colaboradorId: s.id, dia: dayKeyToDate(dia), anuladaEm: null },
    orderBy: { momento: "asc" },
    select: { id: true, momento: true, origem: true },
  });
  return lista.map((m) => ({ id: m.id, hora: relogio(minutoNoDia(m.momento, dia)), manual: m.origem === "MANUAL" }));
}
