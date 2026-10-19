"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/sessao";
import { hashPassword } from "@/lib/senha";
import { empresasDoRh, SENHA_PADRAO } from "@/lib/integracao";
import { DIAS_DA_SEMANA, lerHorario, type Horario } from "@/lib/calculo";
import { dayKeyToDate, todayKey } from "@/lib/dates";
import type { Estado } from "@/app/actions";

/** Lê os 7 campos de horário ("horario0" a "horario6") de um formulário. */
export async function lerHorarioDoFormulario(formData: FormData): Promise<Horario | string> {
  const horario: Horario = [];
  for (let i = 0; i < 7; i++) {
    const lido = lerHorario(String(formData.get(`horario${i}`) ?? ""));
    if (typeof lido === "string") return `${DIAS_DA_SEMANA[i]}: ${lido}`;
    horario.push(lido);
  }
  if (horario.every((d) => d.length === 0)) return "Informe o horário de pelo menos um dia.";
  return horario;
}

const novaEmpresa = z.object({
  rhCompanyId: z.string().min(1, "Escolha a empresa."),
  regime: z.enum(["BANCO_DE_HORAS", "HORAS_EXTRAS"]),
  inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Diga desde quando o ponto conta."),
});

/** Momento 1 da integração: cria o ponto de uma empresa que veio do RH. */
export async function criarEmpresa(_prev: Estado, formData: FormData): Promise<Estado> {
  await exigirAdmin();
  const parsed = novaEmpresa.safeParse({
    rhCompanyId: formData.get("rhCompanyId"),
    regime: formData.get("regime"),
    inicio: formData.get("inicio") || todayKey(),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message };
  const horario = await lerHorarioDoFormulario(formData);
  if (typeof horario === "string") return { erro: horario };

  // O nome vem do RH, não do formulário: é a mesma empresa nos dois sistemas.
  const rh = await empresasDoRh();
  if (!rh.ok) return { erro: rh.erro };
  const daLista = rh.empresas.find((e) => e.id === parsed.data.rhCompanyId);
  if (!daLista) return { erro: "Essa empresa não está mais no RH." };

  const existe = await prisma.empresa.findUnique({ where: { rhCompanyId: daLista.id }, select: { id: true } });
  if (existe) redirect(`/admin/empresas/${existe.id}`);

  const e = await prisma.empresa.create({
    data: {
      rhCompanyId: daLista.id,
      nome: daLista.nome,
      regime: parsed.data.regime,
      horario,
      inicio: dayKeyToDate(parsed.data.inicio),
    },
  });
  revalidatePath("/admin");
  redirect(`/admin/empresas/${e.id}`);
}

export async function alternarEmpresa(id: string) {
  await exigirAdmin();
  const e = await prisma.empresa.findUniqueOrThrow({ where: { id }, select: { ativo: true } });
  await prisma.empresa.update({ where: { id }, data: { ativo: !e.ativo } });
  revalidatePath(`/admin/empresas/${id}`);
  revalidatePath("/admin");
}

/** Atualiza o nome com o que está no RH agora. */
export async function sincronizarNome(id: string) {
  await exigirAdmin();
  const e = await prisma.empresa.findUniqueOrThrow({ where: { id }, select: { rhCompanyId: true } });
  const rh = await empresasDoRh();
  const atual = rh.ok ? rh.empresas.find((x) => x.id === e.rhCompanyId) : null;
  if (atual) await prisma.empresa.update({ where: { id }, data: { nome: atual.nome } });
  revalidatePath(`/admin/empresas/${id}`);
}

const novoColaborador = z.object({
  empresaId: z.string().min(1),
  email: z.string().trim().toLowerCase().email("Confira o email."),
  nome: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
});

/** Cadastra o colaborador pelo email, com a senha padrão trocada no primeiro acesso. */
export async function cadastrarColaborador(_prev: Estado, formData: FormData): Promise<Estado> {
  await exigirAdmin();
  const parsed = novoColaborador.safeParse({
    empresaId: formData.get("empresaId"),
    email: formData.get("email"),
    nome: formData.get("nome") ?? undefined,
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const [existe, admin] = await Promise.all([
    prisma.colaborador.findUnique({ where: { email: d.email }, include: { empresa: { select: { nome: true } } } }),
    prisma.admin.findUnique({ where: { email: d.email }, select: { id: true } }),
  ]);
  if (existe) return { erro: `Esse email já está cadastrado em ${existe.empresa.nome}.` };
  if (admin) return { erro: "Esse email é de um administrador do ponto." };

  await prisma.colaborador.create({
    data: { empresaId: d.empresaId, email: d.email, nome: d.nome, senhaHash: await hashPassword(SENHA_PADRAO) },
  });
  revalidatePath(`/admin/empresas/${d.empresaId}`);
  return { ok: `${d.email} cadastrado. A senha do primeiro acesso é ${SENHA_PADRAO}.` };
}

/** Volta a senha para a padrão e pede a troca no próximo acesso. Derruba as sessões abertas. */
export async function redefinirSenha(id: string) {
  await exigirAdmin();
  const c = await prisma.colaborador.update({
    where: { id },
    data: { senhaHash: await hashPassword(SENHA_PADRAO), trocarSenha: true, sessionVersion: { increment: 1 } },
    select: { empresaId: true },
  });
  revalidatePath(`/admin/empresas/${c.empresaId}`);
}

export async function alternarColaborador(id: string) {
  await exigirAdmin();
  const atual = await prisma.colaborador.findUniqueOrThrow({ where: { id }, select: { ativo: true } });
  const c = await prisma.colaborador.update({
    where: { id },
    data: { ativo: !atual.ativo, sessionVersion: { increment: 1 } },
    select: { empresaId: true },
  });
  revalidatePath(`/admin/empresas/${c.empresaId}`);
}

/** Só some quem nunca bateu ponto: com batidas, o caminho é desativar. */
export async function excluirColaborador(id: string) {
  await exigirAdmin();
  const c = await prisma.colaborador.findUniqueOrThrow({ where: { id }, select: { empresaId: true, _count: { select: { marcacoes: true } } } });
  if (c._count.marcacoes === 0) await prisma.colaborador.delete({ where: { id } });
  revalidatePath(`/admin/empresas/${c.empresaId}`);
}
