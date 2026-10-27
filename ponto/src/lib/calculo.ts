/**
 * O cálculo do ponto eletrônico, todo puro.
 *
 * Cada dia de trabalho é lido a partir das batidas em "minutos desde a
 * meia-noite do dia" — quem entra às 22h e sai às 6h tem a saída em 1800
 * (30h), e o par fecha sem virar dois dias pela metade.
 *
 * As regras seguem a CLT no que é comum a quase toda empresa: tolerância
 * diária (art. 58, §1º), intervalo mínimo (art. 71), descanso entre jornadas
 * (art. 66) e limite de 2h extras por dia (art. 59). O que é convenção
 * coletiva de cada categoria (percentuais maiores, adicional noturno) fica
 * fora: o sistema aponta, o RH e o contador decidem.
 */

import { FUSO } from "./dates";

export type Regime = "BANCO_DE_HORAS" | "HORAS_EXTRAS";
export type TipoOcorrencia = "FERIADO" | "FOLGA" | "FERIAS" | "ABONO" | "ATESTADO";

/** Um trecho do horário, em minutos desde a meia-noite: [08:00, 12:00] = [480, 720]. */
export type Periodo = [number, number];
/** Os trechos de cada dia da semana, de domingo (0) a sábado (6). */
export type Horario = Periodo[][];

export type RegrasPonto = {
  regime: Regime;
  /** O horário padrão: o que cai fora dele é hora extra. */
  horario: Horario;
  tolerancia: number;
  intervaloMinimo: number;
  /**
   * Banco por semana: a conta é o total da semana contra o horário dela (40h
   * no padrão). O dia não tem tolerância, para que um dia a mais e outro a
   * menos se acertem na semana, e o saldo do dia é trabalhado − previsto.
   */
  porSemana?: boolean;
};

/** 08:00 às 12:00 e 13:00 às 17:00, de segunda a sexta: 40h semanais. */
export const HORARIO_PADRAO: Horario = [
  [],
  [[480, 720], [780, 1020]],
  [[480, 720], [780, 1020]],
  [[480, 720], [780, 1020]],
  [[480, 720], [780, 1020]],
  [[480, 720], [780, 1020]],
  [],
];

export const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const NOME_DA_OCORRENCIA: Record<TipoOcorrencia, string> = {
  FERIADO: "Feriado",
  FOLGA: "Folga",
  FERIAS: "Férias",
  ABONO: "Abono",
  ATESTADO: "Atestado",
};

/** O dia deixa de ter horário previsto. */
const ZERA_A_JORNADA: TipoOcorrencia[] = ["FERIADO", "FOLGA", "FERIAS"];
/** O dia tem horário, mas o que faltar é dado como cumprido. */
const ABONA_O_DIA: TipoOcorrencia[] = ["ABONO", "ATESTADO"];

export const LIMITE_EXTRA_DIARIO = 120;
export const DESCANSO_ENTRE_JORNADAS = 11 * 60;

// ------------------------------------------------------------------ horas

/** 125 → "2:05"; -30 → "-0:30". */
export function horas(minutos: number): string {
  const sinal = minutos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutos));
  return `${sinal}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Como `horas`, mas com "+" na frente do positivo: é um saldo. */
export function saldoEscrito(minutos: number): string {
  return minutos > 0 ? `+${horas(minutos)}` : horas(minutos);
}

/** "08:30" → 510. Aceita "8:30" e "830". Devolve null quando não é hora. */
export function lerHora(texto: string): number | null {
  const limpo = texto.trim();
  const m = /^(\d{1,2}):?(\d{2})$/.exec(limpo);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "8:00" ou "8" ou "8h" → 480, para a jornada. Vazio é zero. */
export function lerDuracao(texto: string): number | null {
  const limpo = texto.trim().toLowerCase().replace("h", ":");
  if (!limpo) return 0;
  const m = /^(\d{1,2})(?::(\d{0,2}))?$/.exec(limpo);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 → "08:30"; 1530 (dia seguinte) → "01:30". */
export function relogio(minutos: number): string {
  const m = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// --------------------------------------------------------------- instantes

function partesNoFuso(instante: Date) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const v = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return { ano: v("year"), mes: v("month"), dia: v("day"), hora: v("hour"), minuto: v("minute") };
}

/**
 * A batida em minutos desde a meia-noite do dia de trabalho, no fuso do
 * escritório. Batida do dia seguinte passa de 1440.
 */
export function minutoNoDia(instante: Date, dia: string): number {
  const p = partesNoFuso(instante);
  const [a, m, d] = dia.split("-").map(Number);
  const dias = Math.round(
    (Date.UTC(p.ano, p.mes - 1, p.dia) - Date.UTC(a, m - 1, d)) / 86_400_000,
  );
  return dias * 1440 + p.hora * 60 + p.minuto;
}

/** O instante de "AAAA-MM-DD" às `minutos` (pode passar de 1440), no fuso do escritório. */
export function instanteNoDia(dia: string, minutos: number): Date {
  const [a, m, d] = dia.split("-").map(Number);
  const palpite = Date.UTC(a, m - 1, d, 0, minutos);
  // A diferença entre o palpite lido no fuso e ele mesmo é o deslocamento.
  const p = partesNoFuso(new Date(palpite));
  const lido = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto);
  return new Date(palpite - (lido - palpite));
}

/** 0 = domingo, a partir de "AAAA-MM-DD". */
export function diaDaSemana(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Todos os dias de "AAAA-MM", em ordem. */
export function diasDoMes(mes: string): string[] {
  const [a, m] = mes.split("-").map(Number);
  const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`);
}

/** "2026-09" → "2026-10"; aceita delta negativo. */
export function outroMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

// --------------------------------------------------------------------- dia

export type DiaParaCalcular = {
  dia: string;
  /** Minutos desde a meia-noite do dia, das batidas válidas. */
  batidas: number[];
  ocorrencia?: TipoOcorrencia | null;
  /** O dia ainda está correndo: não se cobra saída nem falta. */
  emAndamento?: boolean;
};

export type DiaCalculado = {
  dia: string;
  semana: number;
  batidas: number[];
  pares: [number, number | null][];
  /** O horário previsto do dia (vazio em folga, feriado, férias). */
  horario: Periodo[];
  ocorrencia: TipoOcorrencia | null;
  previsto: number;
  trabalhado: number;
  abonado: number;
  /** Extras − débito, já com a tolerância aplicada: é o que vai para o banco de horas. */
  saldo: number;
  /** Tempo trabalhado fora do horário padrão. */
  extras: number;
  extras50: number;
  extras100: number;
  /** Tempo do horário que não foi trabalhado (atraso, saída cedo ou falta), positivo. */
  debito: number;
  falta: boolean;
  emAndamento: boolean;
  alertas: string[];
};

/** Quanto dos pares cai dentro dos trechos do horário. */
export function sobreposicao(pares: [number, number][], periodos: Periodo[]): number {
  let total = 0;
  for (const [ini, fim] of pares) {
    for (const [pi, pf] of periodos) {
      total += Math.max(0, Math.min(fim, pf) - Math.max(ini, pi));
    }
  }
  return total;
}

/**
 * Um dia de trabalho.
 *
 * O horário padrão manda: o que foi trabalhado fora dele é extra, o que dele
 * ficou sem trabalhar é débito. Quem chega 30 min atrasado e sai 30 min depois
 * tem 0:30 de atraso e 0:30 de extra, como nos sistemas de ponto comuns. No
 * banco de horas os dois se compensam no saldo.
 */
export function calcularDia(entrada: DiaParaCalcular, regras: RegrasPonto): DiaCalculado {
  const semana = diaDaSemana(entrada.dia);
  const batidas = [...entrada.batidas].sort((a, b) => a - b);
  const ocorrencia = entrada.ocorrencia ?? null;
  const emAndamento = Boolean(entrada.emAndamento);
  const alertas: string[] = [];

  const pares: [number, number | null][] = [];
  for (let i = 0; i < batidas.length; i += 2) {
    pares.push([batidas[i], batidas[i + 1] ?? null]);
  }
  const fechados = pares.filter((p): p is [number, number] => p[1] !== null);

  let trabalhado = 0;
  for (const [ini, fim] of fechados) trabalhado += fim - ini;

  const horarioDoDia = regras.horario[semana] ?? [];
  const horario = ocorrencia && ZERA_A_JORNADA.includes(ocorrencia) ? [] : horarioDoDia;
  const previsto = horario.reduce((s, [i, f]) => s + (f - i), 0);
  const dentro = sobreposicao(fechados, horario);

  let extraBruto = trabalhado - dentro;
  let faltaBruta = previsto - dentro;
  const abonado = ocorrencia && ABONA_O_DIA.includes(ocorrencia) ? faltaBruta : 0;
  if (abonado) faltaBruta = 0;

  if (batidas.length % 2 === 1 && !emAndamento) {
    alertas.push("Marcação ímpar: falta uma batida");
  }

  // Intervalo: o maior vão entre um par e o seguinte.
  if (!emAndamento && batidas.length % 2 === 0) {
    let maiorIntervalo = 0;
    for (let i = 1; i < pares.length; i++) {
      const fimAnterior = pares[i - 1][1];
      if (fimAnterior !== null) maiorIntervalo = Math.max(maiorIntervalo, pares[i][0] - fimAnterior);
    }
    if (trabalhado > 360 && maiorIntervalo < regras.intervaloMinimo) {
      alertas.push(`Intervalo menor que ${horas(regras.intervaloMinimo)}`);
    } else if (trabalhado > 240 && trabalhado <= 360 && maiorIntervalo < 15) {
      alertas.push("Intervalo menor que 15 min");
    }
  }

  const falta = !emAndamento && previsto > 0 && trabalhado === 0 && abonado === 0;
  if (falta) alertas.push("Falta");

  // Com marcação ímpar o dia fica sem conta até o RH completar a batida.
  // Dentro da tolerância não conta nada; passou dela, conta tudo (Súmula 366 do TST).
  const tolerancia = regras.porSemana ? 0 : regras.tolerancia;
  if (emAndamento || batidas.length % 2 === 1 || extraBruto + faltaBruta <= tolerancia) {
    extraBruto = 0;
    faltaBruta = 0;
  }

  // Domingo sem horário e feriado trabalhados pagam em dobro.
  const emDobro = ocorrencia === "FERIADO" || (semana === 0 && horarioDoDia.length === 0);
  const extras = extraBruto;
  const extras100 = emDobro ? extras : 0;
  const extras50 = emDobro ? 0 : extras;
  const debito = faltaBruta;
  const saldo = extras - debito;

  if (extras > LIMITE_EXTRA_DIARIO && !emDobro) alertas.push("Mais de 2h extras no dia");

  return {
    dia: entrada.dia,
    semana,
    batidas,
    pares,
    horario,
    ocorrencia,
    previsto,
    trabalhado,
    abonado,
    saldo,
    extras,
    extras50,
    extras100,
    debito,
    falta,
    emAndamento,
    alertas,
  };
}

// ----------------------------------------------------------------- período

export type Totais = {
  previsto: number;
  trabalhado: number;
  abonado: number;
  saldo: number;
  extras50: number;
  extras100: number;
  debito: number;
  faltas: number;
  alertas: number;
};

export function totalizar(dias: DiaCalculado[]): Totais {
  const t: Totais = {
    previsto: 0,
    trabalhado: 0,
    abonado: 0,
    saldo: 0,
    extras50: 0,
    extras100: 0,
    debito: 0,
    faltas: 0,
    alertas: 0,
  };
  for (const d of dias) {
    if (d.emAndamento) continue;
    t.previsto += d.previsto;
    t.trabalhado += d.trabalhado;
    t.abonado += d.abonado;
    t.saldo += d.saldo;
    t.extras50 += d.extras50;
    t.extras100 += d.extras100;
    t.debito += d.debito;
    if (d.falta) t.faltas += 1;
    t.alertas += d.alertas.length;
  }
  return t;
}

export type Semana<D extends DiaCalculado = DiaCalculado> = {
  /** O domingo que abre a semana. */
  inicio: string;
  dias: D[];
  totais: Totais;
};

/** Os dias agrupados em semanas de domingo a sábado, na ordem em que vieram. */
export function porSemanas<D extends DiaCalculado>(dias: D[]): Semana<D>[] {
  const semanas: Semana<D>[] = [];
  for (const d of dias) {
    const [a, m, dd] = d.dia.split("-").map(Number);
    const domingo = new Date(Date.UTC(a, m - 1, dd - d.semana)).toISOString().slice(0, 10);
    const atual = semanas.at(-1);
    if (atual && atual.inicio === domingo) atual.dias.push(d);
    else semanas.push({ inicio: domingo, dias: [d], totais: totalizar([]) });
  }
  for (const s of semanas) s.totais = totalizar(s.dias);
  return semanas;
}

/**
 * Os dias em sequência, com o que só se vê olhando o dia anterior: o
 * descanso entre uma jornada e a outra.
 */
export function calcularDias(dias: DiaParaCalcular[], regras: RegrasPonto): DiaCalculado[] {
  const ordenados = [...dias].sort((a, b) => a.dia.localeCompare(b.dia));
  const calculados = ordenados.map((d) => calcularDia(d, regras));

  for (let i = 1; i < calculados.length; i++) {
    const ontem = calculados[i - 1];
    const hoje = calculados[i];
    if (ontem.batidas.length === 0 || hoje.batidas.length === 0) continue;
    if (diferencaEmDias(ontem.dia, hoje.dia) !== 1) continue;
    const saida = ontem.batidas[ontem.batidas.length - 1] - 1440;
    const descanso = hoje.batidas[0] - saida;
    if (descanso < DESCANSO_ENTRE_JORNADAS) {
      hoje.alertas.push(`Descanso entre jornadas de ${horas(descanso)} (mínimo 11:00)`);
    }
  }

  return calculados;
}

function diferencaEmDias(de: string, ate: string): number {
  const [a1, m1, d1] = de.split("-").map(Number);
  const [a2, m2, d2] = ate.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

/**
 * Entrada ou saída: a batida seguinte depende de quantas o dia já tem.
 */
export function proximaBatida(quantasNoDia: number): "Entrada" | "Saída" {
  return quantasNoDia % 2 === 0 ? "Entrada" : "Saída";
}

/**
 * A que dia de trabalho pertence uma batida agora.
 *
 * Se ontem ficou com a jornada aberta (número ímpar de batidas) e a última
 * foi há menos de 16h, esta batida é a saída de ontem — é o turno da noite.
 * Fora isso, é do dia de hoje.
 */
export function diaDaBatida({
  hoje,
  ontem,
  batidasDeOntem,
  batidasDeHoje,
  agora,
}: {
  hoje: string;
  ontem: string;
  batidasDeOntem: Date[];
  batidasDeHoje: number;
  agora: Date;
}): string {
  if (batidasDeHoje > 0) return hoje;
  if (batidasDeOntem.length % 2 === 1) {
    const ultima = Math.max(...batidasDeOntem.map((b) => b.getTime()));
    if (agora.getTime() - ultima < 16 * 3_600_000) return ontem;
  }
  return hoje;
}

/** O horário da pessoa, quando tem um próprio; senão o da empresa. */
export function horarioDaPessoa(daEmpresa: Horario, daPessoa: Horario | null | undefined): Horario {
  return daPessoa && daPessoa.length === 7 ? daPessoa : daEmpresa;
}

/** Horas previstas na semana, em minutos. */
export function cargaSemanal(horario: Horario): number {
  return horario.reduce((s, dia) => s + dia.reduce((t, [i, f]) => t + (f - i), 0), 0);
}

/** [[480, 720], [780, 1020]] → "08:00–12:00 13:00–17:00". Vazio é "". */
export function horarioEscrito(periodos: Periodo[]): string {
  return periodos.map(([i, f]) => `${relogio(i)}–${relogio(f)}`).join(" ");
}

/**
 * "08:00-12:00 13:00-17:00" → [[480, 720], [780, 1020]]. Aceita "8-12",
 * "08:00 às 12:00", vírgula ou "e" entre os trechos. Trecho que vira a noite
 * (22:00-06:00) passa de 1440. Devolve a mensagem de erro quando não dá.
 */
export function lerHorario(texto: string): Periodo[] | string {
  const limpo = texto
    .toLowerCase()
    .replace(/\s+(?:às|as|a|até)\s+/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+e\s+|[,;]/g, " ")
    .trim();
  if (!limpo) return [];

  const periodos: Periodo[] = [];
  for (const trecho of limpo.split(/\s+/)) {
    const m = /^(\d{1,2}(?::?\d{2})?)h?-(\d{1,2}(?::?\d{2})?)h?$/.exec(trecho);
    if (!m) return `Não entendi "${trecho}". Use 08:00-12:00.`;
    const ini = lerHora(m[1].includes(":") || m[1].length > 2 ? m[1] : `${m[1]}:00`);
    let fim = lerHora(m[2].includes(":") || m[2].length > 2 ? m[2] : `${m[2]}:00`);
    if (ini === null || fim === null) return `Confira as horas de "${trecho}".`;
    if (fim <= ini) fim += 1440;
    const anterior = periodos.at(-1);
    let inicio = ini;
    if (anterior && inicio < anterior[1]) inicio += 1440;
    if (anterior && inicio < anterior[1]) return "Os trechos se sobrepõem.";
    if (inicio !== ini) fim += 1440;
    periodos.push([inicio, fim]);
  }
  const total = periodos.reduce((s, [i, f]) => s + (f - i), 0);
  if (total > 16 * 60) return "Mais de 16 horas num dia: confira o horário.";
  return periodos;
}

/** Confere um horário vindo de fora (JSON): 7 dias, trechos em ordem, sem sobreposição. */
export function horarioValido(valor: unknown): valor is Horario {
  if (!Array.isArray(valor) || valor.length !== 7) return false;
  return valor.every((dia) => {
    if (!Array.isArray(dia)) return false;
    let fimAnterior = -1;
    for (const p of dia) {
      if (!Array.isArray(p) || p.length !== 2) return false;
      const [i, f] = p;
      if (!Number.isInteger(i) || !Number.isInteger(f) || i < 0 || f <= i || f > 2880 || i < fimAnterior) return false;
      fimAnterior = f;
    }
    return true;
  });
}

/** Só os números do CPF (ou PIS). */
export function soDigitos(texto: string | null | undefined): string {
  return (texto ?? "").replace(/\D/g, "");
}
