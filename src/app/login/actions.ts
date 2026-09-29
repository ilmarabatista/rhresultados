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
  });

  redirect("/empresas");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
