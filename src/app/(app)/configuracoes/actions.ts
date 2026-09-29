"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { SETTINGS_ID } from "@/lib/settings";
import { slugify } from "@/lib/text";

export type ConfigState = { error?: string; ok?: boolean };

const opt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

const settingsSchema = z.object({
  orgName: z.string().trim().min(2, "Informe o nome da empresa de RH."),
  orgDocument: opt,
  orgContact: opt,
  reportFooter: opt,
});

export async function updateSettings(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  await requireAdmin();

  const parsed = settingsSchema.safeParse({
    orgName: formData.get("orgName"),
    orgDocument: formData.get("orgDocument"),
    orgContact: formData.get("orgContact"),
    reportFooter: formData.get("reportFooter"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const dados = {
    orgName: parsed.data.orgName,
    orgDocument: parsed.data.orgDocument ?? null,
    orgContact: parsed.data.orgContact ?? null,
    reportFooter: parsed.data.reportFooter ?? null,
  };

  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: dados,
    create: { id: SETTINGS_ID, ...dados },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/relatorios");
  return { ok: true };
}

// ------------------------------------------------- Catálogo de produtos

const servicoSchema = z.object({
  serviceId: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome do produto."),
  description: opt,
});

/**
 * Cria ou atualiza um produto do catálogo. O produto é o que o plano de
 * treinamento, a reunião e a agenda oferecem para escolher.
 */
export async function saveService(
  _prev: ConfigState,
  formData: FormData,
): Promise<ConfigState> {
  await requireAdmin();

  const parsed = servicoSchema.safeParse({
    serviceId: formData.get("serviceId") ?? undefined,
    name: formData.get("name"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const d = parsed.data;
  const slug = slugify(d.name);
  if (!slug) return { error: "Informe o nome do produto." };

  if (d.serviceId) {
    await prisma.service.update({
      where: { id: d.serviceId },
      data: { name: d.name, description: d.description ?? null },
    });
  } else {
    const existente = await prisma.service.findUnique({ where: { slug } });
    if (existente) return { error: "Já existe um produto com esse nome." };

    const ultimo = await prisma.service.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    await prisma.service.create({
      data: {
        slug,
        name: d.name,
        description: d.description ?? null,
        order: (ultimo?.order ?? -1) + 1,
      },
    });
  }

  revalidatePath("/configuracoes");
  return { ok: true };
}

/**
 * Tira o produto da lista de escolha, ou o traz de volta.
 *
 * Só desativa: excluir de vez tiraria o produto dos planos, reuniões e
 * compromissos que já o usam.
 */
export async function toggleServiceActive(serviceId: string, active: boolean) {
  await requireAdmin();
  await prisma.service.update({ where: { id: serviceId }, data: { active } });
  revalidatePath("/configuracoes");
  revalidatePath("/empresas", "layout");
  revalidatePath("/agenda");
}
