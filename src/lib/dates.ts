/** Utilitários de data — tudo em UTC, sem dependências externas. */

/** Data normalizada em UTC 00:00, a partir de "AAAA-MM-DD". */
export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "2026-03-14" a partir de um Date, lendo os campos UTC. */
export function dateToDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDaysUTC(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * "Hoje", no fuso do escritório.
 *
 * Ler a data local do processo dava certo nesta máquina e errado na Vercel,
 * que roda em UTC: depois das 21h o servidor já achava que era amanhã. O
 * mesmo vale no navegador — por isso tela nenhuma calcula "hoje" por conta
 * própria, todas passam por aqui.
 */
export function todayKey(): string {
  return momentDayKey(new Date());
}

/**
 * O mesmo dia, um ano depois: o "até" padrão de uma série semanal.
 * 29 de fevereiro sem ano bissexto à frente cai em 1º de março.
 */
export function umAnoDepois(dia: string): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  return dateToDayKey(new Date(Date.UTC(ano + 1, mes - 1, d)));
}

export function formatFullDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

/**
 * O fuso do escritório.
 *
 * As datas de agenda são guardadas em UTC 00:00 e lidas em UTC — não têm hora,
 * então não escorregam. Já um instante gravado com `new Date()` tem hora: uma
 * etapa cumprida às 21h de terça é meia-noite de quarta em UTC, e apareceria
 * no dia errado. Por isso todo instante é lido aqui, no fuso de quem usa.
 */
export const FUSO = "America/Sao_Paulo";

/** "11/09/2026" a partir de um instante, no fuso do escritório. */
export function formatMoment(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** "11/09" — o mesmo instante, sem o ano, para linhas apertadas. */
export function formatDayMonth(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/** "AAAA-MM-DD" de um instante, no fuso do escritório: agrupa por dia. */
export function momentDayKey(date: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return partes;
}

/**
 * "11/09" de uma data de agenda.
 *
 * Data de agenda é dia sem hora, guardada em UTC 00:00 — tem que ser lida em
 * UTC. Lê-la no fuso do escritório a jogaria para o dia anterior.
 */
export function formatDayMonthUTC(date: Date | null | undefined): string {
  if (!date) return "—";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
}
