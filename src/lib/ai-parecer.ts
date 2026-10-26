import "server-only";
import { createHash } from "node:crypto";
import { chamarIA, extractJson } from "./ai-cliente";
import { prisma } from "./prisma";
import { lerFicha } from "./ficha";
import { lerEntrevista } from "./entrevista";
import {
  avaliacaoDaIA,
  pedidoDoParecer,
  SYSTEM_DA_AVALIACAO,
  SYSTEM_DO_PARECER,
  testeEmTexto,
  type Avaliacao,
  type DadosDoParecer,
} from "./fluxo-da-vaga";
import { textoSeguro } from "./texto-seguro";

/**
 * O que a IA lê da pasta do candidato (ficha, testes, entrevista, descrição do
 * cargo e anotações) para o rascunho do parecer e para a avaliação automática.
 * Vai como privado: são dados pessoais do candidato.
 */

/** Tudo o que a pasta tem para a IA ler; "vazia" quando não há ficha, teste nem entrevista. */
export async function dadosDaPasta(candidatoId: string): Promise<DadosDoParecer | "vazia" | null> {
  const c = await prisma.candidate.findUnique({
    where: { id: candidatoId },
    select: {
      applicationAnswers: true,
      applicationAnsweredAt: true,
      entrevista: true,
      stageNotes: true,
      jobOpening: {
        select: {
          title: true,
          etapas: { select: { id: true, nome: true } },
          cargo: { select: { missao: true, responsabilidades: true, requisitos: true, competencias: { orderBy: { ordem: "asc" }, select: { nome: true } } } },
        },
      },
      testes: { where: { status: "RESPONDIDO" }, orderBy: { respondidoEm: "asc" }, select: { nomeDoTeste: true, resultado: true } },
    },
  });
  if (!c || !c.jobOpening) return null;

  const ficha = c.applicationAnsweredAt ? lerFicha(c.applicationAnswers) : null;
  const entrevista = lerEntrevista(c.entrevista);
  if (!ficha && c.testes.length === 0 && !entrevista) return "vazia";
  const notas = c.stageNotes && typeof c.stageNotes === "object" && !Array.isArray(c.stageNotes) ? (c.stageNotes as Record<string, unknown>) : {};
  const nomes = new Map(c.jobOpening.etapas.map((e) => [e.id, e.nome]));
  const cargo = c.jobOpening.cargo;
  return {
    vaga: c.jobOpening.title,
    cargo: cargo
      ? {
          missao: cargo.missao ?? "",
          responsabilidades: cargo.responsabilidades ?? "",
          requisitos: cargo.requisitos ?? "",
          competencias: cargo.competencias.map((k) => k.nome),
        }
      : null,
    ficha,
    testes: c.testes.map((t) => testeEmTexto(t.nomeDoTeste, t.resultado)),
    entrevista,
    anotacoes: Object.entries(notas)
      .filter((par): par is [string, string] => typeof par[1] === "string" && par[1].trim() !== "")
      .map(([id, texto]) => ({ etapa: nomes.get(id) ?? "Etapa", texto })),
  };
}

/** A impressão digital do que a IA leria: muda quando a pasta muda. */
export function assinaturaDaPasta(dados: DadosDoParecer): string {
  return createHash("sha256").update(pedidoDoParecer(dados)).digest("hex").slice(0, 32);
}

/** O rascunho do parecer final, a partir de tudo o que está na pasta. */
export async function rascunharParecer(dados: DadosDoParecer): Promise<string> {
  const bruto = await chamarIA(SYSTEM_DO_PARECER, pedidoDoParecer(dados), 2_000, { privado: true });
  return textoSeguro(bruto)
    .replace(/^[#*\s]+/gm, "")
    .trim()
    .slice(0, 10_000);
}

/** A avaliação automática: notas por área, pontos fortes e de atenção. */
export async function avaliarPasta(dados: DadosDoParecer): Promise<Avaliacao | null> {
  const bruto = await chamarIA(SYSTEM_DA_AVALIACAO, pedidoDoParecer(dados), 3_000, { privado: true });
  const lida = avaliacaoDaIA(extractJson(bruto), assinaturaDaPasta(dados));
  if (!lida) return null;
  // O banco é WIN1252: tudo o que a IA escreveu passa pelo filtro.
  return {
    ...lida,
    criterios: lida.criterios.map((c) => ({ ...c, comentario: textoSeguro(c.comentario) })),
    pontosFortes: lida.pontosFortes.map(textoSeguro),
    pontosDeAtencao: lida.pontosDeAtencao.map(textoSeguro),
    resumo: textoSeguro(lida.resumo),
  };
}
