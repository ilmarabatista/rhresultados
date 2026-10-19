"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/senha";
import { abrirSessao, fecharSessao, sessaoAtual } from "@/lib/sessao";
import { ipDoCliente, loginBloqueado, MINUTOS_DE_BLOQUEIO, registrarTentativa } from "@/lib/tentativas";
import { SENHA_PADRAO } from "@/lib/integracao";

export type Estado = { erro?: string; ok?: string };

/** Uma tela de entrada só: o email diz se é administrador ou colaborador. */
export async function entrar(_prev: Estado, formData: FormData): Promise<Estado> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe email e senha." };

  const ip = await ipDoCliente();
  if (await loginBloqueado(email, ip)) {
    return { erro: `Muitas tentativas erradas. Espere ${MINUTOS_DE_BLOQUEIO} minutos.` };
  }

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (admin?.ativo && (await verifyPassword(senha, admin.senhaHash))) {
    await registrarTentativa(email, ip, true);
    await abrirSessao({ tipo: "admin", id: admin.id, versao: admin.sessionVersion });
    redirect("/admin");
  }

  const colaborador = await prisma.colaborador.findUnique({
    where: { email },
    include: { empresa: { select: { ativo: true } } },
  });
  if (colaborador && (await verifyPassword(senha, colaborador.senhaHash))) {
    if (!colaborador.ativo || !colaborador.empresa.ativo) {
      return { erro: "Seu acesso ao ponto está desativado. Fale com o RH." };
    }
    await registrarTentativa(email, ip, true);
    await abrirSessao({ tipo: "colaborador", id: colaborador.id, versao: colaborador.sessionVersion });
    redirect(colaborador.trocarSenha ? "/trocar-senha" : "/");
  }

  await registrarTentativa(email, ip, false);
  return { erro: "Email ou senha incorretos." };
}

export async function sair() {
  await fecharSessao();
  redirect("/entrar");
}

const novaSenha = z
  .object({
    atual: z.string().min(1, "Digite a senha atual."),
    nova: z.string().min(6, "A nova senha precisa de pelo menos 6 caracteres."),
    confirma: z.string(),
  })
  .refine((d) => d.nova === d.confirma, { message: "As duas senhas novas não são iguais.", path: ["confirma"] })
  .refine((d) => d.nova !== SENHA_PADRAO, { message: "Escolha uma senha diferente da padrão.", path: ["nova"] });

/** Troca de senha: obrigatória no primeiro acesso do colaborador; o administrador troca a dele também. */
export async function trocarSenha(_prev: Estado, formData: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  const parsed = novaSenha.safeParse({
    atual: formData.get("atual"),
    nova: formData.get("nova"),
    confirma: formData.get("confirma"),
  });
  if (!parsed.success) return { erro: parsed.error.issues[0]?.message };

  const atual =
    s.tipo === "admin"
      ? await prisma.admin.findUniqueOrThrow({ where: { id: s.id } })
      : await prisma.colaborador.findUniqueOrThrow({ where: { id: s.id } });
  if (!(await verifyPassword(parsed.data.atual, atual.senhaHash))) return { erro: "A senha atual não confere." };

  const senhaHash = await hashPassword(parsed.data.nova);
  const versao =
    s.tipo === "admin"
      ? (await prisma.admin.update({ where: { id: s.id }, data: { senhaHash, sessionVersion: { increment: 1 } } })).sessionVersion
      : (
          await prisma.colaborador.update({
            where: { id: s.id },
            data: { senhaHash, trocarSenha: false, sessionVersion: { increment: 1 } },
          })
        ).sessionVersion;
  await abrirSessao({ tipo: s.tipo, id: s.id, versao });
  // Quem redireciona é a tela: o redirect daqui renderizaria a página com o
  // cookie antigo, que a troca de senha acabou de invalidar.
  return { ok: "Senha trocada." };
}
