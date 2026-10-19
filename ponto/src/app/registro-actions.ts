"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { ipDoCliente } from "@/lib/tentativas";
import { dayKeyToDate } from "@/lib/dates";
import { proximaBatida, relogio } from "@/lib/calculo";
import { jornadaAtual, lerFoto } from "@/lib/batidas";

export type Batida = {
  latitude: number;
  longitude: number;
  precisao: number | null;
  foto: string;
};

export type ResultadoBatida =
  | { ok: true; tipo: "Entrada" | "Saída"; hora: string; nsr: number }
  | { ok: false; erro: string };

/**
 * A batida do colaborador: a hora é a do servidor, nunca a do celular. O
 * local e a foto vão junto e o RH vê os dois no espelho.
 */
export async function baterPonto(b: Batida): Promise<ResultadoBatida> {
  const s = await exigirColaborador();
  if (!s.empresa.ativo) return { ok: false, erro: "O ponto da sua empresa está desativado. Fale com o RH." };

  const { latitude, longitude, precisao } = b;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return { ok: false, erro: "Não recebemos a sua localização. Libere o acesso e tente de novo." };
  }
  const foto = lerFoto(String(b.foto ?? ""));
  if (!foto) return { ok: false, erro: "A foto não chegou direito. Tire outra e tente de novo." };

  const agora = new Date();
  const { dia, batidas } = await jornadaAtual(s.id, agora);
  const ultima = batidas.at(-1);
  // Dois toques seguidos no botão não viram duas batidas.
  if (ultima && agora.getTime() - ultima.momento.getTime() < 60_000) {
    return { ok: false, erro: `Você já bateu o ponto às ${relogio(ultima.minuto)}. Espere um minuto para bater de novo.` };
  }

  const m = await prisma.marcacao.create({
    data: {
      empresaId: s.empresa.id,
      colaboradorId: s.id,
      dia: dayKeyToDate(dia),
      momento: agora,
      origem: "APLICATIVO",
      latitude,
      longitude,
      precisao: precisao !== null && Number.isFinite(precisao) ? Math.round(precisao) : null,
      ip: await ipDoCliente(),
      foto: { create: { dados: new Uint8Array(foto) } },
    },
    select: { nsr: true },
  });

  revalidatePath("/");
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(agora);
  return { ok: true, tipo: proximaBatida(batidas.length), hora, nsr: m.nsr };
}
