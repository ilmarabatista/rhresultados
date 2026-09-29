import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";

/**
 * Trava de força bruta no login.
 *
 * Conta as tentativas falhas recentes por e-mail e por IP. O registro fica no
 * banco em vez de na memória do processo: na Vercel a aplicação roda em várias
 * instâncias, e um contador em memória seria zerado a cada nova instância —
 * ou seja, não travaria nada.
 */

const JANELA_MINUTOS = 15;
/** Falhas no mesmo e-mail antes de bloquear. */
const LIMITE_EMAIL = 5;
/** Falhas no mesmo IP antes de bloquear, cobrindo varredura de e-mails. */
const LIMITE_IP = 20;

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const encaminhado = h.get("x-forwarded-for");
  // x-forwarded-for pode vir como "cliente, proxy1, proxy2".
  if (encaminhado) return encaminhado.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export type Bloqueio = { bloqueado: true; minutos: number } | { bloqueado: false };

export async function checkLoginAllowed(
  email: string,
  ip: string | null,
): Promise<Bloqueio> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);

  const [porEmail, porIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: desde } },
    }),
    ip
      ? prisma.loginAttempt.count({
          where: { ip, success: false, createdAt: { gte: desde } },
        })
      : Promise.resolve(0),
  ]);

  if (porEmail >= LIMITE_EMAIL || porIp >= LIMITE_IP) {
    return { bloqueado: true, minutos: JANELA_MINUTOS };
  }
  return { bloqueado: false };
}

export async function recordLoginAttempt(
  email: string,
  ip: string | null,
  success: boolean,
) {
  await prisma.loginAttempt.create({ data: { email, ip, success } });

  // Entrou: zera o histórico de falhas para não punir quem só errou a senha.
  if (success) {
    await prisma.loginAttempt.deleteMany({ where: { email, success: false } });
  }
}

/** Descarta tentativas antigas para a tabela não crescer sem limite. */
export async function purgeOldAttempts() {
  const limite = new Date(Date.now() - 24 * 60 * 60_000);
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: limite } },
  });
}

export type TentativaRecente = {
  email: string;
  ip: string | null;
  falhas: number;
  ultima: Date;
  bloqueado: boolean;
};

/** Resumo das falhas recentes, para o administrador enxergar o bloqueio. */
export async function recentFailures(): Promise<TentativaRecente[]> {
  const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000);

  const tentativas = await prisma.loginAttempt.findMany({
    where: { success: false, createdAt: { gte: desde } },
    orderBy: { createdAt: "desc" },
    select: { email: true, ip: true, createdAt: true },
  });

  const porEmail = new Map<string, TentativaRecente>();
  for (const t of tentativas) {
    const atual = porEmail.get(t.email);
    if (atual) {
      atual.falhas += 1;
    } else {
      porEmail.set(t.email, {
        email: t.email,
        ip: t.ip,
        falhas: 1,
        ultima: t.createdAt,
        bloqueado: false,
      });
    }
  }

  return [...porEmail.values()]
    .map((t) => ({ ...t, bloqueado: t.falhas >= LIMITE_EMAIL }))
    .sort((a, b) => b.falhas - a.falhas);
}

/** Zera as falhas de um e-mail, liberando o acesso na hora. */
export async function clearFailures(email: string) {
  await prisma.loginAttempt.deleteMany({ where: { email, success: false } });
}
