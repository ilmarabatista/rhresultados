"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { textoDoFormulario } from "@/lib/texto-seguro";
import { lerPerguntaDoFormulario } from "@/lib/clima-dados";
import { BIBLIOTECA_INICIAL } from "@/lib/clima-biblioteca";

/**
 * A biblioteca da pesquisa de clima: as dimensões e as perguntas de onde cada
 * empresa monta a sua pesquisa. Editar aqui não muda pesquisa já montada: cada
 * pesquisa guarda a sua cópia das perguntas.
 */

export type BibliotecaState = { error?: string; ok?: boolean; id?: string };

function refresh() {
  revalidatePath("/clima");
}

export async function carregarBibliotecaInicial(): Promise<BibliotecaState> {
  await requireSession();
  if (await prisma.dimensaoDeClima.count()) return { error: "A biblioteca já tem dimensões." };

  await prisma.$transaction(
    BIBLIOTECA_INICIAL.map((d, i) =>
      prisma.dimensaoDeClima.create({
        data: {
          nome: d.nome,
          descricao: d.descricao,
          ordem: (i + 1) * 10,
          perguntas: {
            create: d.perguntas.map((p, j) => ({
              enunciado: p.enunciado,
              tipo: p.tipo ?? "NOTA",
              opcoes: p.opcoes ?? undefined,
              maxEscolhas: p.maxEscolhas ?? null,
              enps: p.enps ?? false,
              padrao: p.padrao ?? false,
              ordem: (j + 1) * 10,
            })),
          },
        },
      }),
    ),
  );
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- dimensões

export async function salvarDimensao(_prev: BibliotecaState, formData: FormData): Promise<BibliotecaState> {
  await requireSession();
  const id = textoDoFormulario(formData.get("id"), 40);
  const nome = textoDoFormulario(formData.get("nome"), 80);
  const descricao = textoDoFormulario(formData.get("descricao"), 600) || null;
  if (nome.length < 2) return { error: "Escreva o nome da dimensão." };

  const mesmoNome = await prisma.dimensaoDeClima.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (mesmoNome) return { error: `Já existe a dimensão "${nome}".` };

  if (id) {
    await prisma.dimensaoDeClima.update({ where: { id }, data: { nome, descricao } });
    refresh();
    return { ok: true, id };
  }
  const ultima = await prisma.dimensaoDeClima.aggregate({ _max: { ordem: true } });
  const nova = await prisma.dimensaoDeClima.create({
    data: { nome, descricao, ordem: (ultima._max.ordem ?? 0) + 10 },
    select: { id: true },
  });
  refresh();
  return { ok: true, id: nova.id };
}

export async function alternarDimensao(id: string, ativa: boolean): Promise<BibliotecaState> {
  await requireSession();
  await prisma.dimensaoDeClima.update({ where: { id }, data: { ativa } });
  refresh();
  return { ok: true };
}

/** Sobe ou desce a dimensão uma posição, trocando a ordem com a vizinha. */
export async function moverDimensao(id: string, direcao: -1 | 1): Promise<BibliotecaState> {
  await requireSession();
  const todas = await prisma.dimensaoDeClima.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true } });
  const i = todas.findIndex((d) => d.id === id);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= todas.length) return { ok: true };
  [todas[i], todas[j]] = [todas[j], todas[i]];
  await prisma.$transaction(todas.map((d, n) => prisma.dimensaoDeClima.update({ where: { id: d.id }, data: { ordem: (n + 1) * 10 } })));
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- perguntas

export async function salvarPergunta(_prev: BibliotecaState, formData: FormData): Promise<BibliotecaState> {
  await requireSession();
  const id = textoDoFormulario(formData.get("id"), 40);
  const dimensaoId = textoDoFormulario(formData.get("dimensaoId"), 40);
  const lido = await lerPerguntaDoFormulario(formData);
  if ("error" in lido) return { error: lido.error };
  const padrao = formData.get("padrao") === "on";
  const enps = lido.dados.tipo === "NOTA" && formData.get("enps") === "on";

  if (!(await prisma.dimensaoDeClima.count({ where: { id: dimensaoId } }))) return { error: "Escolha a dimensão." };

  // Uma pergunta só dá o eNPS em cada pesquisa: marcar uma desmarca as outras.
  if (enps) await prisma.perguntaDeClima.updateMany({ where: { enps: true, companyId: null, ...(id ? { id: { not: id } } : {}) }, data: { enps: false } });

  const data = { ...lido.dados, dimensaoId, padrao, enps, opcoes: lido.dados.opcoes ?? [] };
  if (id) {
    await prisma.perguntaDeClima.update({ where: { id }, data });
    refresh();
    return { ok: true, id };
  }
  const ultima = await prisma.perguntaDeClima.aggregate({ where: { dimensaoId }, _max: { ordem: true } });
  const nova = await prisma.perguntaDeClima.create({ data: { ...data, ordem: (ultima._max.ordem ?? 0) + 10 }, select: { id: true } });
  refresh();
  return { ok: true, id: nova.id };
}

export async function alternarPergunta(id: string, campo: "ativa" | "padrao", valor: boolean): Promise<BibliotecaState> {
  await requireSession();
  await prisma.perguntaDeClima.update({ where: { id }, data: { [campo]: valor } });
  refresh();
  return { ok: true };
}

/** Pergunta que já foi para alguma pesquisa não se apaga: desativa. */
export async function excluirPergunta(id: string): Promise<BibliotecaState> {
  await requireSession();
  const usos = await prisma.perguntaDaPesquisa.count({ where: { perguntaId: id } });
  if (usos > 0) {
    await prisma.perguntaDeClima.update({ where: { id }, data: { ativa: false } });
    refresh();
    return { ok: true };
  }
  await prisma.perguntaDeClima.delete({ where: { id } });
  refresh();
  return { ok: true };
}
