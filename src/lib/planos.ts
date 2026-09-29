/**
 * O plano de treinamento: as datas que a periodicidade dá e o andamento.
 *
 * Puro: a tela do plano e as ações leem daqui.
 */

import { addDaysUTC, dateToDayKey, dayKeyToDate } from "./dates";

export type Periodicidade = "SEMANAL" | "QUINZENAL" | "MENSAL" | "LIVRE";

export const PERIODICIDADES: { valor: Periodicidade; rotulo: string; explicacao: string }[] = [
  { valor: "SEMANAL", rotulo: "Semanal", explicacao: "Uma reunião por semana, no mesmo dia da semana do início." },
  { valor: "QUINZENAL", rotulo: "Quinzenal", explicacao: "Uma reunião a cada duas semanas." },
  { valor: "MENSAL", rotulo: "Mensal", explicacao: "Uma reunião por mês, no mesmo dia do mês do início." },
  { valor: "LIVRE", rotulo: "Sem data fixa", explicacao: "As reuniões ficam a agendar; você marca o dia de cada uma." },
];

export function lerPeriodicidade(valor: unknown): Periodicidade {
  return PERIODICIDADES.some((p) => p.valor === valor) ? (valor as Periodicidade) : "MENSAL";
}

export function rotuloDaPeriodicidade(valor: string): string {
  return PERIODICIDADES.find((p) => p.valor === valor)?.rotulo ?? valor;
}

/**
 * A data seguinte a `dia` na periodicidade. No mensal fica no mesmo dia do
 * mês; quando o mês não tem esse dia (31 em abril), cai no último dia dele.
 * Sem data fixa não há próxima: null.
 */
export function proximaData(dia: string, periodicidade: Periodicidade, diaDoMes?: number): string | null {
  if (periodicidade === "LIVRE") return null;
  if (periodicidade === "SEMANAL") return dateToDayKey(addDaysUTC(dayKeyToDate(dia), 7));
  if (periodicidade === "QUINZENAL") return dateToDayKey(addDaysUTC(dayKeyToDate(dia), 14));
  const [a, m, d] = dia.split("-").map(Number);
  const alvo = diaDoMes ?? d;
  const ultimoDoMes = new Date(Date.UTC(a, m + 1, 0)).getUTCDate();
  return dateToDayKey(new Date(Date.UTC(a, m, Math.min(alvo, ultimoDoMes))));
}

/** As `quantas` datas do plano a partir do início, ou todas null quando é sem data fixa. */
export function datasDoPlano(inicio: string, periodicidade: Periodicidade, quantas: number): (string | null)[] {
  if (periodicidade === "LIVRE") return Array.from({ length: quantas }, () => null);
  const diaDoMes = Number(inicio.slice(8, 10));
  const datas: string[] = [];
  let atual = inicio;
  for (let i = 0; i < quantas; i++) {
    datas.push(atual);
    atual = proximaData(atual, periodicidade, diaDoMes)!;
  }
  return datas;
}

/** Os temas colados, um por linha, sem numeração nem marcador. */
export function lerTemas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)-]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

export type ReuniaoDoPlano = { status: string; date: Date | null };

export type Andamento = {
  total: number;
  realizadas: number;
  agendadas: number;
  aAgendar: number;
  /** Com data que já passou e não foi marcada como realizada. */
  atrasadas: number;
  percentual: number;
};

/** Quanto do plano já foi entregue. Arquivadas não contam. */
export function andamentoDoPlano(reunioes: ReuniaoDoPlano[], hoje: string): Andamento {
  const validas = reunioes.filter((r) => r.status !== "ARQUIVADA");
  const realizadas = validas.filter((r) => r.status === "REALIZADA").length;
  const pendentes = validas.filter((r) => r.status !== "REALIZADA");
  const aAgendar = pendentes.filter((r) => !r.date).length;
  const atrasadas = pendentes.filter((r) => r.date && dateToDayKey(r.date) < hoje).length;
  return {
    total: validas.length,
    realizadas,
    agendadas: pendentes.length - aAgendar,
    aAgendar,
    atrasadas,
    percentual: validas.length ? Math.round((realizadas / validas.length) * 100) : 0,
  };
}

// ---------------------------------------------------------------- encontros

/**
 * Onde o encontro do plano está: só no plano, já na agenda, já virou reunião
 * (com pauta e ata) ou já aconteceu. Realizado vale tanto pela reunião
 * encerrada quanto pelo compromisso marcado como realizado na agenda.
 */
export type EstadoDoEncontro = "PLANEJADO" | "NA_AGENDA" | "EM_REUNIAO" | "REALIZADO";

export const ROTULO_DO_ESTADO: Record<EstadoDoEncontro, string> = {
  PLANEJADO: "só no plano",
  NA_AGENDA: "na agenda",
  EM_REUNIAO: "em reunião",
  REALIZADO: "realizado",
};

export function estadoDoEncontro(e: {
  visita: { status: string } | null;
  reuniao: { status: string } | null;
}): EstadoDoEncontro {
  if (e.reuniao?.status === "REALIZADA" || e.visita?.status === "REALIZADA") return "REALIZADO";
  // A reunião em preparação (PLANEJADA) ainda não conta: vale a agenda.
  if (e.reuniao && e.reuniao.status !== "PLANEJADA") return "EM_REUNIAO";
  if (e.visita) return "NA_AGENDA";
  return "PLANEJADO";
}

/** O andamento a partir dos encontros: realizado conta como entregue. */
export function andamentoDosEncontros(
  encontros: { estado: EstadoDoEncontro; dia: string | null }[],
  hoje: string,
): Andamento {
  return andamentoDoPlano(
    encontros.map((e) => ({
      status: e.estado === "REALIZADO" ? "REALIZADA" : "AGENDADA",
      date: e.dia ? new Date(`${e.dia}T00:00:00Z`) : null,
    })),
    hoje,
  );
}
