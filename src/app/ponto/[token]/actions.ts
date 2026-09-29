"use server";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { clientIp } from "@/lib/rate-limit";
import { addDaysUTC, dateToDayKey, dayKeyToDate, formatMoment, todayKey } from "@/lib/dates";
import { diaDaBatida, proximaBatida, relogio, minutoNoDia, soDigitos } from "@/lib/ponto";

/**
 * A batida de ponto, pelo link público da empresa.
 *
 * A pessoa se identifica com CPF e PIN. Errar o PIN cinco vezes em 15
 * minutos trava aquele CPF — o contador mora na mesma tabela das tentativas
 * de login, com uma chave própria, para não travar o IP do tablet que a
 * empresa inteira usa.
 */

export type BatidaState = {
  error?: string;
  ok?: boolean;
  comprovante?: {
    nome: string;
    empresa: string;
    tipo: "Entrada" | "Saída";
    data: string;
    hora: string;
    nsr: number;
  };
};

const JANELA_MINUTOS = 15;
const LIMITE = 5;

export async function baterPonto(_prev: BatidaState, formData: FormData): Promise<BatidaState> {
  const token = String(formData.get("token") ?? "");
  const cpf = soDigitos(String(formData.get("cpf") ?? ""));
  const pin = String(formData.get("pin") ?? "").trim();

  if (cpf.length !== 11) return { error: "Digite os 11 números do CPF." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "Digite o seu PIN." };

  const config = await prisma.pontoConfig.findUnique({
    where: { token },
    select: { companyId: true, ativo: true, company: { select: { name: true } } },
  });
  if (!config || !config.ativo) return { error: "Este ponto não está ativo. Fale com o RH." };

  const chave = `ponto:${config.companyId}:${cpf}`;
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const falhas = await prisma.loginAttempt.count({
    where: { email: chave, success: false, createdAt: { gte: desde } },
  });
  if (falhas >= LIMITE) {
    return { error: `Muitas tentativas erradas. Espere ${JANELA_MINUTOS} minutos ou fale com o RH.` };
  }

  const ip = await clientIp();
  const candidatos = await prisma.employee.findMany({
    where: { companyId: config.companyId, status: { not: "DESLIGADO" }, pontoPin: { not: null }, document: { not: null } },
    select: { id: true, name: true, document: true, pontoPin: true },
  });
  const pessoa = candidatos.find((c) => soDigitos(c.document) === cpf);

  if (!pessoa || !(await verifyPassword(pin, pessoa.pontoPin!))) {
    await prisma.loginAttempt.create({ data: { email: chave, ip, success: false } });
    return { error: "CPF ou PIN não conferem." };
  }
  await prisma.loginAttempt.deleteMany({ where: { email: chave, success: false } });

  const agora = new Date();
  const hoje = todayKey();
  const ontem = dateToDayKey(addDaysUTC(dayKeyToDate(hoje), -1));

  const recentes = await prisma.pontoMarcacao.findMany({
    where: { employeeId: pessoa.id, anuladaEm: null, dia: { gte: dayKeyToDate(ontem) } },
    orderBy: { momento: "asc" },
    select: { dia: true, momento: true },
  });

  const ultima = recentes.at(-1);
  if (ultima && agora.getTime() - ultima.momento.getTime() < 60_000) {
    return { error: "Você acabou de registrar. Espere um minuto para bater de novo." };
  }

  const deOntem = recentes.filter((r) => dateToDayKey(r.dia) === ontem).map((r) => r.momento);
  const deHoje = recentes.filter((r) => dateToDayKey(r.dia) === hoje).length;
  const dia = diaDaBatida({ hoje, ontem, batidasDeOntem: deOntem, batidasDeHoje: deHoje, agora });
  const jaNoDia = dia === hoje ? deHoje : deOntem.length;

  const marcacao = await prisma.pontoMarcacao.create({
    data: {
      companyId: config.companyId,
      employeeId: pessoa.id,
      dia: dayKeyToDate(dia),
      momento: agora,
      origem: "RELOGIO",
      ip,
    },
    select: { nsr: true },
  });

  return {
    ok: true,
    comprovante: {
      nome: pessoa.name,
      empresa: config.company.name,
      tipo: proximaBatida(jaNoDia),
      data: formatMoment(agora),
      hora: relogio(minutoNoDia(agora, hoje)),
      nsr: marcacao.nsr,
    },
  };
}
