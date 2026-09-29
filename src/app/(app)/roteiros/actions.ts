"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  BLOCOS,
  DURACAO_PADRAO,
  escolherFramework,
  faltando,
  OBJETIVO_PADRAO,
  PUBLICO_PADRAO,
} from "@/lib/roteiros";
import { gerarRoteiros, type Bloco } from "@/lib/ai-roteiro";

export type RoteiroState = {
  error?: string;
  ok?: boolean;
  /** O método manda perguntar em vez de inventar. */
  perguntas?: string[];
  /** Quantos roteiros a IA de fato entregou. */
  quantosSairam?: number;
};

function refresh() {
  revalidatePath("/roteiros");
}

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const criarSchema = z.object({
  tema: z.string().trim().min(3, "Escreva o tema do vídeo."),
  plataforma: opcional,
  oferta: opcional,
  cta: opcional,
  quantidade: z.coerce.number().int().min(1).max(8).default(5),
});

/**
 * Escreve o roteiro.
 *
 * Antes de chamar a IA, confere o que o método exige saber. Faltando público,
 * objetivo ou — quando há oferta — o que é e qual o CTA, a resposta é a lista
 * de perguntas, não um roteiro com promessa inventada.
 */
export async function gerarNovoRoteiro(
  _prev: RoteiroState,
  formData: FormData,
): Promise<RoteiroState> {
  const session = await requireSession();

  const parsed = criarSchema.safeParse({
    tema: formData.get("tema"),
    plataforma: formData.get("plataforma") ?? undefined,
    oferta: formData.get("oferta") ?? undefined,
    cta: formData.get("cta") ?? undefined,
    quantidade: formData.get("quantidade") || 5,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  // Escrever à mão: nasce um roteiro com os blocos do método, em branco, para
  // preencher na própria tela. Não depende de IA nenhuma.
  if (formData.get("modo") === "MAO") {
    const framework = escolherFramework(OBJETIVO_PADRAO);
    const blocos: Bloco[] = BLOCOS[framework].map((rotulo) => ({ rotulo, texto: "" }));
    const { quantidade: _q, ...campos } = d;
    await prisma.script.create({
      data: {
        ...campos,
        publico: PUBLICO_PADRAO,
        objetivo: OBJETIVO_PADRAO,
        duracaoSegundos: DURACAO_PADRAO,
        framework,
        copyThesis: "",
        dsi: "",
        blocos,
        blocosOriginais: blocos,
        ganchosAlternativos: [],
        createdById: session.userId,
      },
    });
    refresh();
    return { ok: true, quantosSairam: 1 };
  }

  const perguntas = faltando({
    tema: d.tema,
    publico: PUBLICO_PADRAO,
    objetivo: OBJETIVO_PADRAO,
    oferta: d.oferta ?? undefined,
    cta: d.cta ?? undefined,
  });
  if (perguntas.length > 0) return { perguntas };

  const framework = escolherFramework(OBJETIVO_PADRAO);

  // As correções recentes ensinam a voz de quem vai gravar.
  const aprendizados = await prisma.scriptEdit.findMany({
    where: { usarComoExemplo: true },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { bloco: true, antes: true, depois: true },
  });

  const { quantidade, ...campos } = d;

  try {
    const gerados = await gerarRoteiros(
      {
        tema: d.tema,
        publico: PUBLICO_PADRAO,
        objetivo: OBJETIVO_PADRAO,
        plataforma: d.plataforma,
        duracaoSegundos: DURACAO_PADRAO,
        oferta: d.oferta,
        cta: d.cta,
      },
      framework,
      quantidade,
      aprendizados,
    );

    for (const g of gerados) {
      await prisma.script.create({
        data: {
          ...campos,
          publico: PUBLICO_PADRAO,
          objetivo: OBJETIVO_PADRAO,
          duracaoSegundos: DURACAO_PADRAO,
          framework,
          angulo: g.angulo || null,
          copyThesis: g.copyThesis,
          dsi: g.dsi,
          blocos: g.blocos,
          blocosOriginais: g.blocos,
          ganchosAlternativos: g.ganchosAlternativos,
          createdById: session.userId,
        },
      });
    }

    refresh();
    return { ok: true, quantosSairam: gerados.length };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Não foi possível escrever o roteiro.",
    };
  }
}

const blocoSchema = z.object({
  rotulo: z.string().trim().min(1),
  texto: z.string(),
});

/**
 * Grava o roteiro editado à mão, e registra cada bloco que mudou.
 *
 * O registro é o que ensina o sistema: nas próximas gerações, essas correções
 * entram no prompt como exemplo de como esta pessoa escreve.
 */
export async function salvarEdicao(
  _prev: RoteiroState,
  formData: FormData,
): Promise<RoteiroState> {
  await requireSession();

  const id = String(formData.get("id") ?? "");
  const roteiro = await prisma.script.findUnique({
    where: { id },
    select: { blocos: true },
  });
  if (!roteiro) return { error: "Roteiro não encontrado." };

  let novos: Bloco[];
  try {
    novos = z
      .array(blocoSchema)
      .min(1)
      .parse(JSON.parse(String(formData.get("blocos") ?? "[]")));
  } catch {
    return { error: "Não foi possível ler o roteiro editado." };
  }

  const antigos = roteiro.blocos as unknown as Bloco[];
  const porRotulo = new Map(antigos.map((b) => [b.rotulo, b.texto]));

  const mudancas = novos.filter((b) => {
    const antes = porRotulo.get(b.rotulo) ?? "";
    return antes.trim() !== b.texto.trim() && antes.trim().length > 0;
  });

  await prisma.script.update({
    where: { id },
    data: { blocos: novos },
  });

  if (mudancas.length > 0) {
    await prisma.scriptEdit.createMany({
      data: mudancas.map((b) => ({
        scriptId: id,
        bloco: b.rotulo,
        antes: porRotulo.get(b.rotulo) ?? "",
        depois: b.texto,
      })),
    });
  }

  refresh();
  return { ok: true };
}

const STATUS = [
  "RASCUNHO",
  "APROVADO",
  "GRAVADO",
  "PUBLICADO",
  "DESCARTADO",
] as const;

/** Decide o destino do roteiro: vai ser gravado, ou some da fila. */
export async function mudarStatus(
  id: string,
  status: string,
  porque?: string,
): Promise<RoteiroState> {
  await requireSession();

  if (!STATUS.includes(status as (typeof STATUS)[number])) {
    return { error: "Situação inválida." };
  }
  if (status === "DESCARTADO" && !porque?.trim()) {
    return { error: "Diga por que está descartando — é o que ensina o sistema." };
  }

  await prisma.script.update({
    where: { id },
    data: {
      status: status as (typeof STATUS)[number],
      descartadoPorque: status === "DESCARTADO" ? (porque ?? null) : null,
    },
  });

  refresh();
  return { ok: true };
}

export async function excluirRoteiro(id: string) {
  await requireSession();
  await prisma.script.delete({ where: { id } });
  refresh();
}

/** Tira uma correção do material de aprendizado, sem apagar o histórico. */
export async function esquecerExemplo(id: string, usar: boolean) {
  await requireSession();
  await prisma.scriptEdit.update({
    where: { id },
    data: { usarComoExemplo: usar },
  });
  refresh();
}
