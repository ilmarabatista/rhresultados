"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAdmin } from "@/lib/session";
import { clearFailures } from "@/lib/rate-limit";

export type UserFormState = { error?: string; ok?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  role: z.enum(["ADMIN", "MEMBRO"]).default("MEMBRO"),
});

export async function createUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  await requireAdmin();

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") || "MEMBRO",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existente = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existente) return { error: "Já existe um usuário com esse e-mail." };

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
    },
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Acesso criado para ${parsed.data.email}.` };
}

const edicaoSchema = z.object({
  userId: z.string().min(1, "Usuário não identificado."),
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  role: z.enum(["ADMIN", "MEMBRO"]),
  // Em branco mantém a senha atual.
  password: z
    .string()
    .refine(
      (v) => v === "" || v.length >= 8,
      "A nova senha deve ter ao menos 8 caracteres.",
    ),
});

export async function updateUser(
  _prev: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const admin = await requireAdmin();

  const parsed = edicaoSchema.safeParse({
    userId: formData.get("userId") ?? "",
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role") || "MEMBRO",
    password: formData.get("password") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { userId, name, email, role, password } = parsed.data;

  const atual = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!atual) return { error: "Usuário não encontrado." };

  const outro = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (outro && outro.id !== userId) {
    return { error: "Já existe um usuário com esse e-mail." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      // Um administrador não tira o próprio perfil de administrador, para o
      // sistema não ficar sem ninguém que gerencie os acessos.
      role: admin.userId === userId ? atual.role : role,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
  });

  // O nome também aparece no menu lateral, que vem do layout.
  revalidatePath("/", "layout");
  return { ok: "Dados salvos." };
}

export async function toggleUserActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  // Um administrador não desativa a própria conta.
  if (admin.userId === userId) return;

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/usuarios");
}

/** Libera um e-mail travado por tentativas, sem esperar a janela passar. */
export async function unlockLogin(email: string) {
  await requireAdmin();
  await clearFailures(email);
  revalidatePath("/admin/usuarios");
}
