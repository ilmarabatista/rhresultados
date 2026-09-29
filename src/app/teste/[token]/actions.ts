"use server";

import { prisma } from "@/lib/prisma";
import { calcularDisc, conferirRespostas, lerFormularioDisc, type RespostaDisc } from "@/lib/disc";
import {
  apurar,
  conferirRespostasCadastradas,
  lerRespostasCadastradas,
  lerTesteCadastrado,
  type RespostaCadastrada,
} from "@/lib/testes-cadastrados";

/**
 * O teste respondido pelo link. Não há sessão: o token é a credencial, e cada
 * link aceita uma resposta só. A apuração sai na hora e fica gravada.
 */

export type RespostaState = { error?: string; ok?: boolean };

export async function responderTeste(_prev: RespostaState, formData: FormData): Promise<RespostaState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "Link inválido." };

  const envio = await prisma.testeEnviado.findUnique({
    where: { token },
    select: { id: true, tipo: true, status: true, estrutura: true },
  });
  if (!envio) return { error: "Link inválido." };
  if (envio.status === "RESPONDIDO") return { error: "Este teste já foi respondido." };

  let respostas: RespostaDisc[] | RespostaCadastrada[];
  let resultado: object;

  if (envio.tipo === "DISC") {
    const lidas = lerFormularioDisc(formData);
    const problema = conferirRespostas(lidas);
    if (problema) return { error: problema };
    const completas = lidas as RespostaDisc[];
    respostas = completas;
    resultado = calcularDisc(completas);
  } else {
    const copia = lerTesteCadastrado(envio.estrutura);
    if (!copia) return { error: "Este teste está sem questões. Fale com quem enviou o link." };
    const lidas = lerRespostasCadastradas(formData, copia);
    const problema = conferirRespostasCadastradas(lidas, copia);
    if (problema) return { error: problema };
    const completas = lidas as RespostaCadastrada[];
    respostas = completas;
    resultado = apurar(copia, completas);
  }

  // O `status` na condição impede duas respostas ao mesmo tempo no mesmo link.
  const { count } = await prisma.testeEnviado.updateMany({
    where: { id: envio.id, status: "ENVIADO" },
    data: { status: "RESPONDIDO", respostas, resultado, respondidoEm: new Date() },
  });
  if (count === 0) return { error: "Este teste já foi respondido." };

  return { ok: true };
}
