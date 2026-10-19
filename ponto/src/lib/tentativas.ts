import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

/** Trava de força bruta no login: por email e por IP, contada no banco. */

const JANELA_MINUTOS = 15;
const LIMITE_EMAIL = 5;
const LIMITE_IP = 30;

export async function ipDoCliente(): Promise<string | null> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function loginBloqueado(email: string, ip: string | null): Promise<boolean> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);
  const [porEmail, porIp] = await Promise.all([
    prisma.tentativaLogin.count({ where: { email, sucesso: false, createdAt: { gte: desde } } }),
    ip ? prisma.tentativaLogin.count({ where: { ip, sucesso: false, createdAt: { gte: desde } } }) : 0,
  ]);
  return porEmail >= LIMITE_EMAIL || porIp >= LIMITE_IP;
}

export async function registrarTentativa(email: string, ip: string | null, sucesso: boolean) {
  await prisma.tentativaLogin.create({ data: { email, ip, sucesso } });
  if (sucesso) await prisma.tentativaLogin.deleteMany({ where: { email, sucesso: false } });
}

export const MINUTOS_DE_BLOQUEIO = JANELA_MINUTOS;
