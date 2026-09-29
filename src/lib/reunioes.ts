/**
 * A reunião registrada à mão: a pauta escrita antes, a ata escrita depois.
 *
 * A ata tem três partes, e cada uma pede uma coisa: o conversado é contexto,
 * sem responsável nem prazo; o decidido vale desde uma data e tem um porquê; o
 * combinado tem um responsável e uma data. Puro, para ser testado sem banco.
 */

import { semAcento } from "./text";

export const TIPOS_DE_ITEM = ["CONVERSADO", "DECIDIDO", "COMBINADO"] as const;
export type TipoDeItem = (typeof TIPOS_DE_ITEM)[number];

/**
 * PLANEJADA é o encontro de um plano de treinamento sendo preparado (pauta,
 * participantes, apresentação) antes de ir para reunião: tem a mesma página,
 * mas ainda não aparece na aba Reuniões.
 */
export const SITUACOES_DA_REUNIAO = ["PLANEJADA", "AGENDADA", "REALIZADA", "ARQUIVADA"] as const;
export type SituacaoDaReuniao = (typeof SITUACOES_DA_REUNIAO)[number];

export const ROTULO_DA_SITUACAO: Record<SituacaoDaReuniao, string> = {
  PLANEJADA: "Em preparação",
  AGENDADA: "Agendada",
  REALIZADA: "Realizada",
  ARQUIVADA: "Arquivada",
};

export function lerSituacao(valor: string): SituacaoDaReuniao {
  return (SITUACOES_DA_REUNIAO as readonly string[]).includes(valor)
    ? (valor as SituacaoDaReuniao)
    : "AGENDADA";
}

/** "REU-0013": o número da reunião na empresa, com quatro dígitos. */
export function codigoDaReuniao(numero: number): string {
  return `REU-${String(Math.max(0, Math.trunc(numero))).padStart(4, "0")}`;
}

function normalizar(texto: string): string {
  return semAcento(texto).toLowerCase().trim();
}

/**
 * A busca da lista: título, plano, setor, tipo, local ou o código. Sem acento e
 * sem caixa, e o código aceita "REU-0013", "reu 13" ou só "13".
 */
export function reuniaoCombina(
  r: {
    titulo: string;
    numero: number;
    plano?: string | null;
    setor?: string | null;
    tipo?: string | null;
    local?: string | null;
  },
  busca: string,
): boolean {
  const termo = normalizar(busca);
  if (!termo) return true;

  const codigo = termo.match(/^(?:reu[\s-]*)?0*(\d+)$/);
  if (codigo && r.numero > 0 && Number(codigo[1]) === r.numero) return true;

  return [r.titulo, r.plano, r.setor, r.tipo, r.local]
    .filter((v): v is string => Boolean(v))
    .some((v) => normalizar(v).includes(termo));
}

export type SituacaoDoCombinado = "FEITO" | "ATRASADO" | "HOJE" | "NO_PRAZO" | "SEM_DATA";

/** Em que pé está um combinado, olhando o dia de hoje ("AAAA-MM-DD"). */
export function situacaoDoCombinado(
  c: { feito: boolean; prazo: string | null },
  hoje: string,
): SituacaoDoCombinado {
  if (c.feito) return "FEITO";
  if (!c.prazo) return "SEM_DATA";
  if (c.prazo < hoje) return "ATRASADO";
  if (c.prazo === hoje) return "HOJE";
  return "NO_PRAZO";
}

/** Quantos combinados da ata ainda não foram feitos. */
export function combinadosAbertos(itens: { tipo: string; feito: boolean }[]): number {
  return itens.filter((i) => i.tipo === "COMBINADO" && !i.feito).length;
}
