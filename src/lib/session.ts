import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./prisma";

const COOKIE = "rh_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(value);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  role: "ADMIN" | "MEMBRO";
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Apenas o conteúdo do cookie, sem consultar o banco. */
async function readCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role === "ADMIN" ? "ADMIN" : "MEMBRO",
    };
  } catch {
    return null;
  }
}

/**
 * Sessão válida de verdade: o cookie precisa ser legítimo E o usuário precisa
 * continuar existindo e ativo.
 *
 * Sem essa conferência, desativar alguém em Usuários não teria efeito até o
 * cookie expirar, o que leva até 7 dias. Nome e perfil também vêm do banco, e
 * não do cookie, para que uma promoção ou rebaixamento valha na hora.
 *
 * `cache` do React garante uma consulta por requisição, mesmo que vários
 * layouts e páginas chamem.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const doCookie = await readCookie();
  if (!doCookie) return null;

  const user = await prisma.user.findUnique({
    where: { id: doCookie.userId },
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  if (!user || !user.active) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
});

/** Sessão obrigatória: redireciona para o login quando ausente ou revogada. */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "ADMIN") redirect("/empresas");
  return session;
}
