"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { createSession, destroySession } from "@/lib/session";
import {
  checkLoginAllowed,
  clientIp,
  purgeOldAttempts,
  recordLoginAttempt,
} from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginState = { error?: string };

/**
 * Hash de uma senha aleatória que ninguém conhece. Conferir a senha contra ele
 * quando o e-mail não existe faz a resposta levar o mesmo tempo nos dois
 * casos, e o tempo deixa de revelar quais e-mails têm acesso.
 */
const HASH_FICTICIO = "$2b$10$wCrVvGvhIoJXIuwzUW0jM.OrLyvTylfEj3Qa7PIM5HsbtLiQKgEoO";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { email, password } = parsed.data;
  const ip = await clientIp();

  const bloqueio = await checkLoginAllowed(email, ip);
  if (bloqueio.bloqueado) {
    return {
      error: `Muitas tentativas seguidas. Espere ${bloqueio.minutos} minutos e tente de novo.`,
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Mensagem genérica: não revela se o e-mail existe.
  const invalid = { error: "E-mail ou senha incorretos." };

  if (!user || !user.active) {
    await verifyPassword(password, HASH_FICTICIO);
    await recordLoginAttempt(email, ip, false);
    return invalid;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordLoginAttempt(email, ip, false);
    return invalid;
  }

  await recordLoginAttempt(email, ip, true);
  await purgeOldAttempts();

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  redirect("/empresas");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
