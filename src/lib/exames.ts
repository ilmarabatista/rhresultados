/**
 * Regras dos exames ocupacionais, sem banco e sem React — é o que os testes
 * cobrem.
 *
 * O exame ocupacional é obrigação da empresa, não do RH que a assessora, mas
 * quem cobra o cumprimento é a consultoria. Por isso ele aparece aqui como
 * tarefa: o que importa é o que está por fazer e o que já venceu.
 */

import { addDaysUTC, dateToDayKey, dayKeyToDate } from "./dates";

export type TipoExame =
  | "ADMISSIONAL"
  | "PERIODICO"
  | "RETORNO_AO_TRABALHO"
  | "MUDANCA_DE_FUNCAO"
  | "DEMISSIONAL";

export type StatusExame = "A_AGENDAR" | "AGENDADO" | "REALIZADO" | "CANCELADO";

export type ResultadoExame = "APTO" | "APTO_COM_RESTRICAO" | "INAPTO";

export const TIPOS: { valor: TipoExame; label: string; quando: string }[] = [
  {
    valor: "ADMISSIONAL",
    label: "Admissional",
    quando: "Antes do primeiro dia de trabalho.",
  },
  {
    valor: "PERIODICO",
    label: "Periódico",
    quando: "No vencimento do ASO anterior.",
  },
  {
    valor: "RETORNO_AO_TRABALHO",
    label: "Retorno ao trabalho",
    quando: "No primeiro dia de volta, após afastamento de 30 dias ou mais.",
  },
  {
    valor: "MUDANCA_DE_FUNCAO",
    label: "Mudança de função",
    quando: "Antes da mudança, quando o risco da nova função é diferente.",
  },
  {
    valor: "DEMISSIONAL",
    label: "Demissional",
    quando: "No desligamento, dentro do prazo do último exame válido.",
  },
];

export const STATUS: { valor: StatusExame; label: string }[] = [
  { valor: "A_AGENDAR", label: "a agendar" },
  { valor: "AGENDADO", label: "agendado" },
  { valor: "REALIZADO", label: "realizado" },
  { valor: "CANCELADO", label: "cancelado" },
];

export const RESULTADOS: { valor: ResultadoExame; label: string }[] = [
  { valor: "APTO", label: "Apto" },
  { valor: "APTO_COM_RESTRICAO", label: "Apto com restrição" },
  { valor: "INAPTO", label: "Inapto" },
];

export function rotuloDoTipo(tipo: string): string {
  return TIPOS.find((t) => t.valor === tipo)?.label ?? tipo;
}

export function rotuloDoStatus(status: string): string {
  return STATUS.find((s) => s.valor === status)?.label ?? status;
}

export function rotuloDoResultado(resultado: string | null): string | null {
  if (!resultado) return null;
  return RESULTADOS.find((r) => r.valor === resultado)?.label ?? resultado;
}

/**
 * Validade padrão do ASO, em meses, por tipo de exame.
 *
 * A NR-7 manda no máximo um ano para a maioria dos casos, e seis meses para
 * quem tem mais de 45 anos ou trabalha exposto a risco. O sistema sugere doze
 * e deixa mudar: quem decide o prazo é o médico do trabalho, não o software.
 */
export const VALIDADE_PADRAO_MESES = 12;

/** Soma meses a um dia "AAAA-MM-DD", segurando o fim de mês curto. */
export function somarMeses(dia: string, meses: number): string {
  const d = dayKeyToDate(dia);
  const ano = d.getUTCFullYear();
  const mes = d.getUTCMonth();
  const diaDoMes = d.getUTCDate();

  const alvo = new Date(Date.UTC(ano, mes + meses, 1));
  // 31 de janeiro + 1 mês não existe: cai no último dia de fevereiro.
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return dateToDayKey(
    new Date(
      Date.UTC(
        alvo.getUTCFullYear(),
        alvo.getUTCMonth(),
        Math.min(diaDoMes, ultimoDia),
      ),
    ),
  );
}

/** Quando vence o ASO de um exame realizado em `dia`. */
export function validadeDe(
  dia: string,
  meses = VALIDADE_PADRAO_MESES,
): string {
  return somarMeses(dia, meses);
}

/**
 * O prazo do admissional é o dia anterior ao início do trabalho: começar sem
 * exame não é permitido. Sem data de admissão, não há prazo a sugerir.
 */
export function prazoAdmissional(admissao: string | null | undefined): string | null {
  if (!admissao) return null;
  return dateToDayKey(addDaysUTC(dayKeyToDate(admissao), -1));
}

export type Urgencia = "ATRASADO" | "HOJE" | "PROXIMO" | "EM_DIA" | "SEM_PRAZO";

/**
 * Quão urgente está o exame, comparando o prazo com hoje.
 * "Próximo" é o que vence dentro de uma semana.
 */
export function urgencia(
  prazo: string | null | undefined,
  hoje: string,
): Urgencia {
  if (!prazo) return "SEM_PRAZO";
  if (prazo < hoje) return "ATRASADO";
  if (prazo === hoje) return "HOJE";
  if (prazo <= dateToDayKey(addDaysUTC(dayKeyToDate(hoje), 7))) return "PROXIMO";
  return "EM_DIA";
}

/** Quantos dias faltam para o prazo; negativo quando já passou. */
export function diasAte(prazo: string, hoje: string): number {
  return Math.round(
    (dayKeyToDate(prazo).getTime() - dayKeyToDate(hoje).getTime()) / 86_400_000,
  );
}

/** "vence hoje", "vencido há 3 dias", "em 5 dias". */
export function textoDoPrazo(
  prazo: string | null | undefined,
  hoje: string,
): string | null {
  if (!prazo) return null;

  const dias = diasAte(prazo, hoje);
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  if (dias === -1) return "vencido ontem";
  if (dias < 0) return `vencido há ${Math.abs(dias)} dias`;
  return `em ${dias} dias`;
}

/** O exame ainda é trabalho a fazer? */
export function pendente(status: string): boolean {
  return status === "A_AGENDAR" || status === "AGENDADO";
}

type Ordenavel = {
  status: string;
  prazo: string | null;
  agendadoEm: string | null;
};

/**
 * Ordem em que os exames aparecem como tarefa: primeiro o que está por fazer,
 * dentro disso o de prazo mais apertado, e por último o que já foi resolvido.
 * Pendência sem prazo vem depois das com prazo, mas antes do que está pronto.
 */
export function ordenarComoTarefa<T extends Ordenavel>(exames: T[]): T[] {
  const peso = (e: T) => (pendente(e.status) ? 0 : e.status === "REALIZADO" ? 1 : 2);

  return [...exames].sort((a, b) => {
    const pa = peso(a);
    const pb = peso(b);
    if (pa !== pb) return pa - pb;

    const da = a.prazo ?? a.agendadoEm;
    const db = b.prazo ?? b.agendadoEm;
    if (da && db) return da.localeCompare(db);
    if (da) return -1;
    if (db) return 1;
    return 0;
  });
}
